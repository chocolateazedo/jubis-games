<?php
declare(strict_types=1);

/**
 * Xadrez x1 — backend de lobby e partidas (Jubis Games).
 *
 * Hospedagem é estática + PHP (sem WebSocket), então usamos polling:
 *  - matchmaking aleatório: fila compartilhada (lobby.json) com flock
 *  - sala privada: senha de 6 caracteres alfanumérica case-sensitive
 *  - partida: estado guardado em g_<id>.json; o cliente (chess.js) é a fonte das regras
 *
 * Todas as chamadas são POST com corpo JSON: { "action": "...", ... }
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const QUEUE_TTL   = 30;   // segundos que um jogador esperando fica vivo sem dar sinal
const POINTER_TTL = 120;  // segundos que um pareamento fica disponível para o jogador buscar
const GAME_TTL    = 86400; // remove partidas com mais de 24h sem atividade
const MAX_CHAT    = 140;   // tamanho máximo de uma mensagem de chat de texto
const CHAT_KEEP   = 25;    // quantas mensagens de chat manter no histórico da partida

$DATA = __DIR__ . '/data';
ensure_data_dir($DATA);

$input  = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'join_random':  echo json_encode(join_random($DATA, $input)); break;
        case 'create_private': echo json_encode(create_private($DATA, $input)); break;
        case 'join_private': echo json_encode(join_private($DATA, $input)); break;
        case 'wait':         echo json_encode(wait_match($DATA, $input)); break;
        case 'cancel':       echo json_encode(cancel($DATA, $input)); break;
        case 'state':        echo json_encode(game_state($DATA, $input)); break;
        case 'move':         echo json_encode(make_move($DATA, $input)); break;
        case 'resign':       echo json_encode(resign($DATA, $input)); break;
        case 'say':          echo json_encode(say_game($DATA, $input)); break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'ação inválida']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'erro interno']);
}

// ----------------------------------------------------------------------------
// Ações
// ----------------------------------------------------------------------------

function join_random(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    if ($name === '') return err('informe um nome');
    gc_games($dir);

    return with_lock($dir, 'lobby', function () use ($dir, $name) {
        $lobby = gc_lobby(read_json($dir . '/lobby.json', empty_lobby()));

        // tem alguém esperando? então pareia.
        if (!empty($lobby['queue'])) {
            $opp = array_shift($lobby['queue']);
            $g = create_game($dir, 'random', null, $opp['name'], $name);
            $lobby['pointers'][$opp['ticket']] = $g['a']; // o que estava esperando descobre via wait()
            write_json($dir . '/lobby.json', $lobby);
            return ['matched' => true] + $g['b'];
        }

        // ninguém esperando: entra na fila.
        $ticket = new_id();
        $lobby['queue'][] = ['ticket' => $ticket, 'name' => $name, 'ts' => time()];
        write_json($dir . '/lobby.json', $lobby);
        return ['matched' => false, 'ticket' => $ticket];
    });
}

function create_private(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    if ($name === '') return err('informe um nome');
    gc_games($dir);

    return with_lock($dir, 'lobby', function () use ($dir, $name) {
        $lobby = gc_lobby(read_json($dir . '/lobby.json', empty_lobby()));

        // senha de 6 caracteres alfanumérica case-sensitive, única entre as salas abertas.
        do { $code = random_code(6); } while (isset($lobby['private'][$code]));

        $ticket = new_id();
        $lobby['private'][$code] = ['ticket' => $ticket, 'name' => $name, 'ts' => time()];
        write_json($dir . '/lobby.json', $lobby);
        return ['ticket' => $ticket, 'code' => $code];
    });
}

function join_private(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    $code = (string)($in['code'] ?? '');
    if ($name === '') return err('informe um nome');
    if (!preg_match('/^[A-Za-z0-9]{6}$/', $code)) return err('senha inválida');
    gc_games($dir);

    return with_lock($dir, 'lobby', function () use ($dir, $name, $code) {
        $lobby = gc_lobby(read_json($dir . '/lobby.json', empty_lobby()));

        if (!isset($lobby['private'][$code])) {
            return err('sala não encontrada ou expirada');
        }
        $host = $lobby['private'][$code];
        unset($lobby['private'][$code]);

        $g = create_game($dir, 'private', $code, $host['name'], $name);
        $lobby['pointers'][$host['ticket']] = $g['a'];
        write_json($dir . '/lobby.json', $lobby);
        return ['matched' => true] + $g['b'];
    });
}

function wait_match(string $dir, array $in): array
{
    $ticket = clean_id($in['ticket'] ?? '');
    if ($ticket === null) return err('ticket inválido');

    return with_lock($dir, 'lobby', function () use ($dir, $ticket) {
        $lobby = gc_lobby(read_json($dir . '/lobby.json', empty_lobby()));

        if (isset($lobby['pointers'][$ticket])) {
            $assign = $lobby['pointers'][$ticket];
            unset($lobby['pointers'][$ticket]);
            write_json($dir . '/lobby.json', $lobby);
            return ['matched' => true] + $assign;
        }

        // mantém o jogador vivo na fila / sala enquanto ele estiver esperando.
        $alive = false;
        foreach ($lobby['queue'] as &$q) {
            if ($q['ticket'] === $ticket) { $q['ts'] = time(); $alive = true; }
        }
        unset($q);
        foreach ($lobby['private'] as &$p) {
            if ($p['ticket'] === $ticket) { $p['ts'] = time(); $alive = true; }
        }
        unset($p);
        if ($alive) write_json($dir . '/lobby.json', $lobby);

        return ['matched' => false, 'waiting' => $alive, 'expired' => !$alive];
    });
}

function cancel(string $dir, array $in): array
{
    $ticket = clean_id($in['ticket'] ?? '');
    if ($ticket === null) return ['ok' => true];

    return with_lock($dir, 'lobby', function () use ($dir, $ticket) {
        $lobby = read_json($dir . '/lobby.json', empty_lobby());
        $lobby['queue'] = array_values(array_filter($lobby['queue'], fn($q) => $q['ticket'] !== $ticket));
        foreach (array_keys($lobby['private']) as $code) {
            if ($lobby['private'][$code]['ticket'] === $ticket) unset($lobby['private'][$code]);
        }
        unset($lobby['pointers'][$ticket]);
        write_json($dir . '/lobby.json', $lobby);
        return ['ok' => true];
    });
}

function game_state(string $dir, array $in): array
{
    $id = clean_id($in['gameId'] ?? '');
    if ($id === null) return err('jogo inválido', 400);
    $g = read_json($dir . "/g_$id.json", null);
    if (!is_array($g)) return err('jogo não encontrado', 404);

    return [
        'fen'      => $g['fen'],
        'turn'     => fen_turn($g['fen']),
        'lastMove' => $g['lastMove'],
        'status'   => $g['status'],
        'winner'   => $g['winner'],
        'white'    => $g['players']['w']['name'],
        'black'    => $g['players']['b']['name'],
        'updatedAt' => $g['updatedAt'],
        'chat'     => array_slice($g['chat'] ?? [], -20),
        'chatSeq'  => $g['chatSeq'] ?? 0,
    ];
}

function say_game(string $dir, array $in): array
{
    $id    = clean_id($in['gameId'] ?? '');
    $color = (string)($in['color'] ?? '');
    $token = clean_id($in['token'] ?? '');
    $text  = clean_chat($in['text'] ?? '');
    if ($id === null || !in_array($color, ['w', 'b'], true) || $token === null) return err('dados inválidos', 400);
    if ($text === '') return err('mensagem vazia');

    return with_lock($dir, "g_$id", function () use ($dir, $id, $color, $token, $text) {
        $g = read_json($dir . "/g_$id.json", null);
        if (!is_array($g)) return err('jogo não encontrado', 404);
        if (($g['players'][$color]['token'] ?? '') !== $token) return err('não autorizado', 403);

        if (!isset($g['chat']) || !is_array($g['chat'])) $g['chat'] = [];
        $seq = ($g['chatSeq'] ?? 0) + 1;
        $g['chatSeq'] = $seq;
        $g['chat'][] = [
            'seq'   => $seq,
            'color' => $color,
            'name'  => $g['players'][$color]['name'] ?? '?',
            'text'  => $text,
            'ts'    => time(),
        ];
        if (count($g['chat']) > CHAT_KEEP) {
            $g['chat'] = array_slice($g['chat'], -CHAT_KEEP);
        }
        $g['updatedAt'] = time();
        write_json($dir . "/g_$id.json", $g);
        return ['ok' => true, 'seq' => $seq];
    });
}

function make_move(string $dir, array $in): array
{
    $id    = clean_id($in['gameId'] ?? '');
    $color = (string)($in['color'] ?? '');
    $token = clean_id($in['token'] ?? '');
    $fen   = (string)($in['fen'] ?? '');
    $from  = (string)($in['from'] ?? '');
    $to    = (string)($in['to'] ?? '');
    $status = (string)($in['status'] ?? 'playing');
    $winner = $in['winner'] ?? null;

    if ($id === null || !in_array($color, ['w', 'b'], true) || $token === null) return err('dados inválidos', 400);
    if (!valid_fen($fen)) return err('posição inválida', 400);
    if (!preg_match('/^[a-h][1-8]$/', $from) || !preg_match('/^[a-h][1-8]$/', $to)) return err('lance inválido', 400);
    if (!in_array($status, ['playing', 'checkmate', 'stalemate', 'draw'], true)) $status = 'playing';
    if (!in_array($winner, ['w', 'b', null], true)) $winner = null;

    return with_lock($dir, "g_$id", function () use ($dir, $id, $color, $token, $fen, $from, $to, $status, $winner) {
        $g = read_json($dir . "/g_$id.json", null);
        if (!is_array($g)) return err('jogo não encontrado', 404);
        if ($g['status'] !== 'playing') return err('partida encerrada', 409);
        if (($g['players'][$color]['token'] ?? '') !== $token) return err('não autorizado', 403);
        if (fen_turn($g['fen']) !== $color) return err('não é sua vez', 409);

        $g['fen'] = $fen;
        $g['lastMove'] = ['from' => $from, 'to' => $to];
        $g['status'] = $status;
        $g['winner'] = $winner;
        $g['updatedAt'] = time();
        write_json($dir . "/g_$id.json", $g);
        return ['ok' => true];
    });
}

function resign(string $dir, array $in): array
{
    $id    = clean_id($in['gameId'] ?? '');
    $color = (string)($in['color'] ?? '');
    $token = clean_id($in['token'] ?? '');
    if ($id === null || !in_array($color, ['w', 'b'], true) || $token === null) return err('dados inválidos', 400);

    return with_lock($dir, "g_$id", function () use ($dir, $id, $color, $token) {
        $g = read_json($dir . "/g_$id.json", null);
        if (!is_array($g)) return err('jogo não encontrado', 404);
        if (($g['players'][$color]['token'] ?? '') !== $token) return err('não autorizado', 403);
        if ($g['status'] === 'playing') {
            $g['status'] = 'resigned';
            $g['winner'] = $color === 'w' ? 'b' : 'w';
            $g['updatedAt'] = time();
            write_json($dir . "/g_$id.json", $g);
        }
        return ['ok' => true];
    });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function create_game(string $dir, string $mode, ?string $code, string $nameA, string $nameB): array
{
    $id = new_id(6);
    $tokA = new_id(); $tokB = new_id();
    // cores aleatórias
    $aColor = random_int(0, 1) === 1 ? 'w' : 'b';
    $bColor = $aColor === 'w' ? 'b' : 'w';

    $players = [];
    $players[$aColor] = ['name' => $nameA, 'token' => $tokA];
    $players[$bColor] = ['name' => $nameB, 'token' => $tokB];

    $game = [
        'id'        => $id,
        'mode'      => $mode,
        'code'      => $code,
        'players'   => $players,
        'fen'       => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'lastMove'  => null,
        'status'    => 'playing',
        'winner'    => null,
        'chat'      => [],
        'chatSeq'   => 0,
        'createdAt' => time(),
        'updatedAt' => time(),
    ];
    write_json($dir . "/g_$id.json", $game);

    // 'a' = jogador que estava esperando; 'b' = quem acabou de entrar.
    return [
        'id' => $id,
        'a'  => ['gameId' => $id, 'color' => $aColor, 'token' => $tokA],
        'b'  => ['gameId' => $id, 'color' => $bColor, 'token' => $tokB],
    ];
}

function empty_lobby(): array
{
    return ['queue' => [], 'private' => [], 'pointers' => []];
}

function gc_lobby(array $lobby): array
{
    $now = time();
    $lobby['queue'] = array_values(array_filter(
        $lobby['queue'] ?? [],
        fn($q) => isset($q['ts']) && ($now - $q['ts']) < QUEUE_TTL
    ));
    foreach (array_keys($lobby['private'] ?? []) as $code) {
        if (($now - ($lobby['private'][$code]['ts'] ?? 0)) >= QUEUE_TTL) unset($lobby['private'][$code]);
    }
    foreach (array_keys($lobby['pointers'] ?? []) as $t) {
        $p = $lobby['pointers'][$t];
        if (isset($p['ts']) && ($now - $p['ts']) >= POINTER_TTL) unset($lobby['pointers'][$t]);
    }
    if (!isset($lobby['queue'])) $lobby['queue'] = [];
    if (!isset($lobby['private'])) $lobby['private'] = [];
    if (!isset($lobby['pointers'])) $lobby['pointers'] = [];
    return $lobby;
}

function gc_games(string $dir): void
{
    $now = time();
    foreach (glob($dir . '/g_*.json') ?: [] as $f) {
        if (($now - @filemtime($f)) > GAME_TTL) @unlink($f);
    }
}

function with_lock(string $dir, string $name, callable $fn)
{
    $fp = fopen($dir . '/.lock_' . $name, 'c');
    if ($fp === false) return $fn();
    flock($fp, LOCK_EX);
    try {
        return $fn();
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

function read_json(string $path, $default)
{
    if (!is_file($path)) return $default;
    $raw = file_get_contents($path);
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : $default;
}

function write_json(string $path, $data): void
{
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE));
    rename($tmp, $path);
}

function ensure_data_dir(string $dir): void
{
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) @file_put_contents($ht, "Require all denied\nDeny from all\n");
}

function new_id(int $bytes = 8): string { return bin2hex(random_bytes($bytes)); }

function random_code(int $len): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    $max = strlen($alphabet) - 1;
    $out = '';
    for ($i = 0; $i < $len; $i++) $out .= $alphabet[random_int(0, $max)];
    return $out;
}

function clean_id($v): ?string
{
    $v = (string)$v;
    return preg_match('/^[a-f0-9]{6,32}$/', $v) ? $v : null;
}

function clean_name($v): string
{
    $v = trim((string)$v);
    $v = preg_replace('/\s+/u', ' ', $v);
    $v = mb_substr($v, 0, 20);
    return $v;
}

function clean_chat($v): string
{
    $v = trim((string)$v);
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v);   // remove quebras/controle
    $v = preg_replace('/\s+/u', ' ', $v);
    return mb_substr($v, 0, MAX_CHAT);
}

function fen_turn(string $fen): string
{
    $parts = explode(' ', $fen);
    return ($parts[1] ?? 'w') === 'b' ? 'b' : 'w';
}

function valid_fen(string $fen): bool
{
    return (bool)preg_match('#^[pnbrqkPNBRQK1-8/]+ [wb] #', $fen) && strlen($fen) <= 100;
}

function err(string $msg, int $code = 200): array
{
    if ($code !== 200) http_response_code($code);
    return ['error' => $msg];
}
