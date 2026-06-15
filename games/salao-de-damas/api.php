<?php
declare(strict_types=1);

/**
 * Salão de Damas — backend simples de salão único (Jubis Games).
 *
 * Hospedagem é estática + PHP (sem WebSocket). Estado em data/salao.json
 * protegido por flock. Todas as chamadas são POST JSON: { "action": "...", ... }
 *
 * Fase 1: join / update (heartbeat + posição) / leave.
 * Fases seguintes adicionam: sit / stand / move (damas) / spectate.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const PLAYER_TTL = 8;     // segundos sem heartbeat -> jogador sai do salão
const MAX_NAME   = 14;
const MAX_PLAYERS = 32;   // limite por segurança no salão
const SIT_DIST   = 2.2;   // distância máx do jogador até a cadeira pra poder sentar

/**
 * Mesas do salão (definição estática — cliente e servidor concordam pelos IDs).
 * Cada mesa tem 2 cadeiras opostas. Seat 0 fica no lado sul (z menor), seat 1 no norte.
 */
const TABLES = [
    ['id' => 't1', 'floor' => 1, 'x' => -9.0, 'z' => -6.0],
    ['id' => 't2', 'floor' => 1, 'x' => -9.0, 'z' =>  6.0],
    ['id' => 't3', 'floor' => 1, 'x' =>  9.0, 'z' => -6.0],
    ['id' => 't4', 'floor' => 1, 'x' =>  9.0, 'z' =>  6.0],
    ['id' => 't5', 'floor' => 1, 'x' =>  0.0, 'z' => -14.0],
    ['id' => 't6', 'floor' => 1, 'x' =>  0.0, 'z' =>  14.0],
];
const SEAT_OFFSET = 1.05;

/** Damas (regras simplificadas estilo brasileiro):
 *  - tabuleiro 8x8, casas escuras onde (r+c)%2 === 1
 *  - peças comuns andam 1 diagonal pra frente
 *  - peças comuns capturam pulando 2 casas em qualquer diagonal (frente OU trás)
 *  - dama (king): anda/captura 1 casa em qualquer diagonal
 *  - quando peça comum chega na última fileira do oponente, vira dama
 *  - multi-jump: se após captura ainda dá pra capturar com a MESMA peça, jogador continua
 *  - ganha quem comer todas as peças do oponente OU deixar oponente sem lance possível
 *  - seat 0 (sul) joga as brancas (descem); seat 1 (norte) joga as pretas (sobem)
 */
const BOARD_N = 8;

$DATA = __DIR__ . '/data';
ensure_data_dir($DATA);

$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'join':    echo json_encode(join_salao($DATA, $input)); break;
        case 'update':  echo json_encode(update_salao($DATA, $input)); break;
        case 'sit':     echo json_encode(sit_salao($DATA, $input)); break;
        case 'stand':   echo json_encode(stand_salao($DATA, $input)); break;
        case 'move':    echo json_encode(move_damas($DATA, $input)); break;
        case 'leave':   echo json_encode(leave_salao($DATA, $input)); break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'ação inválida']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'erro interno']);
}

// ----------------------------------------------------------------------------

function join_salao(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    if ($name === '') return err('digite um nome');

    return with_lock($dir, function (array $state) use ($name) {
        if (count($state['players']) >= MAX_PLAYERS) {
            return [$state, err('o salão está cheio, tenta de novo daqui a pouco')];
        }
        $id   = bin2hex(random_bytes(6));
        $skin = rand_skin($state['players']);
        $state['players'][$id] = [
            'id'   => $id,
            'name' => $name,
            'x'    => (float)(rand(-200, 200) / 100),  // entrada perto do centro
            'y'    => 0.0,
            'z'    => 18.0,                             // entra pela porta (z grande, perto da parede sul)
            'rot'  => 3.14159,                          // virado pro centro
            'skin' => $skin,
            'seat' => null,                             // "tableId:seatIdx" quando sentado
            'ts'   => time(),
        ];
        return [$state, ['id' => $id, 'skin' => $skin, 'tables' => array_values(TABLES)]];
    });
}

function update_salao(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    if ($id === null) return err('id inválido', 400);

    return with_lock($dir, function (array $state) use ($id, $in) {
        if (!isset($state['players'][$id])) {
            return [$state, ['expired' => true]];
        }
        $p =& $state['players'][$id];
        // só atualiza posição se NÃO estiver sentado (a posição é determinada pela cadeira)
        if ($p['seat'] === null) {
            $p['x']  = clean_float($in['x'] ?? $p['x'], -50, 50);
            $p['y']  = clean_float($in['y'] ?? $p['y'], -5, 5);
            $p['z']  = clean_float($in['z'] ?? $p['z'], -50, 50);
            $p['rot']= clean_float($in['rot'] ?? $p['rot'], -10, 10);
        }
        $p['ts'] = time();
        unset($p);

        // devolve estado pra todos os jogadores ativos
        $players = [];
        foreach ($state['players'] as $pid => $pl) {
            $players[] = [
                'id'   => $pl['id'],
                'name' => $pl['name'],
                'x'    => $pl['x'],
                'y'    => $pl['y'],
                'z'    => $pl['z'],
                'rot'  => $pl['rot'],
                'skin' => $pl['skin'],
                'seat' => $pl['seat'] ?? null,
            ];
        }
        // partidas (todas — são poucas; cliente filtra qual interessa)
        $matches = [];
        foreach ($state['matches'] as $tid => $m) {
            $matches[$tid] = [
                'tableId' => $tid,
                'white'   => $m['white'],
                'black'   => $m['black'],
                'board'   => $m['board'],
                'turn'    => $m['turn'],
                'continueWith' => $m['continueWith'],
                'winner'  => $m['winner'],
                'reason'  => $m['reason'],
            ];
        }
        return [$state, ['players' => $players, 'matches' => $matches]];
    });
}

function sit_salao(string $dir, array $in): array
{
    $id     = clean_id($in['id'] ?? '');
    $tid    = (string)($in['tableId'] ?? '');
    $seatIx = (int)($in['seat'] ?? -1);
    if ($id === null) return err('id inválido', 400);
    if ($seatIx !== 0 && $seatIx !== 1) return err('cadeira inválida');

    $table = null;
    foreach (TABLES as $t) if ($t['id'] === $tid) { $table = $t; break; }
    if ($table === null) return err('mesa não encontrada');

    // posição-alvo da cadeira
    $seatX = $table['x'];
    $seatZ = $table['z'] + ($seatIx === 0 ? -SEAT_OFFSET : SEAT_OFFSET);
    $seatRot = $seatIx === 0 ? 0.0 : 3.14159;   // seat 0 olha pro norte; seat 1 pro sul

    return with_lock($dir, function (array $state) use ($id, $tid, $seatIx, $seatX, $seatZ, $seatRot) {
        if (!isset($state['players'][$id])) return [$state, err('você saiu do salão')];
        $p =& $state['players'][$id];

        // a cadeira já está ocupada?
        $seatKey = $tid . ':' . $seatIx;
        foreach ($state['players'] as $other) {
            if ($other['id'] === $id) continue;
            if (($other['seat'] ?? null) === $seatKey) {
                return [$state, err('a cadeira foi ocupada por outro jogador')];
            }
        }

        // o jogador está perto o suficiente?
        $dx = $p['x'] - $seatX; $dz = $p['z'] - $seatZ;
        if (sqrt($dx*$dx + $dz*$dz) > SIT_DIST) {
            return [$state, err('chegue mais perto da cadeira')];
        }

        $p['seat'] = $seatKey;
        $p['x'] = $seatX;
        $p['z'] = $seatZ;
        $p['y'] = 0.0;
        $p['rot'] = $seatRot;
        $p['ts'] = time();
        unset($p);

        // se ambos os assentos da mesa estão ocupados, inicia/reinicia uma partida
        $whiteId = null; $blackId = null;
        foreach ($state['players'] as $pl) {
            if (($pl['seat'] ?? null) === $tid . ':0') $whiteId = $pl['id'];
            if (($pl['seat'] ?? null) === $tid . ':1') $blackId = $pl['id'];
        }
        if ($whiteId !== null && $blackId !== null) {
            $state['matches'][$tid] = [
                'tableId' => $tid,
                'white'   => $whiteId,
                'black'   => $blackId,
                'board'   => damas_init_board(),
                'turn'    => 'white',
                'continueWith' => null,
                'winner'  => null,
                'reason'  => null,
                'endedAt' => null,
                'lastMoveAt' => time(),
                'startedAt'  => time(),
            ];
        }
        return [$state, ['ok' => true, 'seat' => $seatKey, 'x' => $seatX, 'z' => $seatZ, 'rot' => $seatRot]];
    });
}

function stand_salao(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    if ($id === null) return err('id inválido', 400);

    return with_lock($dir, function (array $state) use ($id) {
        if (!isset($state['players'][$id])) return [$state, err('você saiu do salão')];
        // libera assento + encerra match se houver
        $state = release_seat_if_any($state, $id);
        $p =& $state['players'][$id];
        if ($p['seat'] !== null) {
            // empurra o jogador um pouquinho pra trás da cadeira pra ele não voltar a sentar
            $seatRot = $p['rot'];
            $p['x'] -= sin($seatRot) * 1.4;
            $p['z'] -= cos($seatRot) * 1.4;
            $p['seat'] = null;
        }
        $p['ts'] = time();
        unset($p);
        return [$state, ['ok' => true]];
    });
}

// ----- Damas ---------------------------------------------------------------

function move_damas(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    $tid = (string)($in['tableId'] ?? '');
    $from = $in['from'] ?? null;
    $to   = $in['to'] ?? null;
    if ($id === null) return err('id inválido', 400);
    if (!is_array($from) || !is_array($to) || count($from) < 2 || count($to) < 2) return err('lance inválido');
    $fr = (int)$from[0]; $fc = (int)$from[1];
    $tr = (int)$to[0];   $tc = (int)$to[1];

    return with_lock($dir, function (array $state) use ($id, $tid, $fr, $fc, $tr, $tc) {
        if (!isset($state['matches'][$tid])) return [$state, err('não há partida ativa nessa mesa')];
        $m = $state['matches'][$tid];
        if ($m['winner'] !== null) return [$state, err('a partida já terminou')];

        $myColor = ($m['white'] === $id) ? 'white' : (($m['black'] === $id) ? 'black' : null);
        if ($myColor === null) return [$state, err('você não está jogando essa partida')];
        if ($m['turn'] !== $myColor) return [$state, err('não é a sua vez')];

        // se estamos no meio de um multi-jump, o lance precisa começar da peça correta
        if ($m['continueWith'] !== null) {
            [$cr, $cc] = $m['continueWith'];
            if ($fr !== $cr || $fc !== $cc) return [$state, err('continue o sequência de capturas')];
        }

        $piece = $m['board'][$fr][$fc] ?? null;
        if ($piece === null) return [$state, err('não há peça nessa casa')];
        if ($piece['color'] !== $myColor) return [$state, err('essa peça não é sua')];

        // aplica lance
        $result = damas_try_move($m['board'], $fr, $fc, $tr, $tc, $myColor);
        if (!$result['ok']) return [$state, err($result['error'] ?? 'lance ilegal')];
        $m['board'] = $result['board'];
        $m['lastMoveAt'] = time();

        // multi-jump: se foi captura e a peça (na nova posição, podendo ser dama agora) pode capturar de novo, mesmo jogador continua
        if ($result['captured'] && damas_piece_can_capture($m['board'], $tr, $tc)) {
            $m['continueWith'] = [$tr, $tc];
        } else {
            $m['continueWith'] = null;
            $m['turn'] = ($myColor === 'white') ? 'black' : 'white';
        }

        // checa vencedor
        $winner = damas_check_winner($m['board'], $m['turn']);
        if ($winner !== null) {
            $m['winner'] = $winner;
            $m['reason'] = 'checkmate';
            $m['endedAt'] = time();
        }

        $state['matches'][$tid] = $m;
        return [$state, ['ok' => true]];
    });
}

function damas_init_board(): array
{
    $b = [];
    for ($r = 0; $r < BOARD_N; $r++) {
        $row = [];
        for ($c = 0; $c < BOARD_N; $c++) {
            $row[] = null;
        }
        $b[] = $row;
    }
    for ($r = 0; $r < 3; $r++)
        for ($c = 0; $c < BOARD_N; $c++)
            if (($r + $c) % 2 === 1) $b[$r][$c] = ['color' => 'black', 'king' => false];
    for ($r = 5; $r < BOARD_N; $r++)
        for ($c = 0; $c < BOARD_N; $c++)
            if (($r + $c) % 2 === 1) $b[$r][$c] = ['color' => 'white', 'king' => false];
    return $b;
}

function damas_try_move(array $board, int $fr, int $fc, int $tr, int $tc, string $color): array
{
    if ($tr < 0 || $tr >= BOARD_N || $tc < 0 || $tc >= BOARD_N) return ['ok' => false, 'error' => 'fora do tabuleiro'];
    if (($tr + $tc) % 2 !== 1) return ['ok' => false, 'error' => 'casa clara'];
    if ($board[$tr][$tc] !== null) return ['ok' => false, 'error' => 'casa ocupada'];
    $piece = $board[$fr][$fc];
    if ($piece === null) return ['ok' => false, 'error' => 'sem peça'];

    $dr = $tr - $fr; $dc = $tc - $fc;
    if (abs($dr) !== abs($dc) || $dr === 0) return ['ok' => false, 'error' => 'movimento não é diagonal'];

    $forward = ($color === 'white') ? -1 : 1;
    $isKing = !empty($piece['king']);

    // movimento simples (1 casa)
    if (abs($dr) === 1) {
        if (!$isKing && $dr !== $forward) return ['ok' => false, 'error' => 'peça comum só anda pra frente'];
        $board[$fr][$fc] = null;
        $piece = damas_maybe_promote($piece, $tr, $color);
        $board[$tr][$tc] = $piece;
        return ['ok' => true, 'board' => $board, 'captured' => false];
    }

    // captura (pula 2 casas, com inimigo no meio)
    if (abs($dr) === 2) {
        $mr = $fr + ($dr / 2); $mc = $fc + ($dc / 2);
        $mid = $board[$mr][$mc] ?? null;
        if ($mid === null) return ['ok' => false, 'error' => 'não tem peça pra capturar'];
        if ($mid['color'] === $color) return ['ok' => false, 'error' => 'não pode capturar peça própria'];
        $board[$fr][$fc] = null;
        $board[$mr][$mc] = null;
        $piece = damas_maybe_promote($piece, $tr, $color);
        $board[$tr][$tc] = $piece;
        return ['ok' => true, 'board' => $board, 'captured' => true];
    }

    return ['ok' => false, 'error' => 'distância inválida'];
}

function damas_maybe_promote(array $piece, int $r, string $color): array
{
    $lastRow = ($color === 'white') ? 0 : (BOARD_N - 1);
    if ($r === $lastRow) $piece['king'] = true;
    return $piece;
}

function damas_piece_can_capture(array $board, int $r, int $c): bool
{
    $p = $board[$r][$c] ?? null;
    if ($p === null) return false;
    foreach ([[-1,-1],[-1,1],[1,-1],[1,1]] as [$dr, $dc]) {
        $er = $r + $dr; $ec = $c + $dc;
        $lr = $r + 2 * $dr; $lc = $c + 2 * $dc;
        if ($lr < 0 || $lr >= BOARD_N || $lc < 0 || $lc >= BOARD_N) continue;
        $mid = $board[$er][$ec] ?? null;
        $land = $board[$lr][$lc] ?? null;
        if ($mid !== null && $mid['color'] !== $p['color'] && $land === null) return true;
    }
    return false;
}

function damas_check_winner(array $board, string $turn): ?string
{
    $hasOwn = false;
    $hasMove = false;
    for ($r = 0; $r < BOARD_N; $r++) {
        for ($c = 0; $c < BOARD_N; $c++) {
            $p = $board[$r][$c];
            if ($p === null || $p['color'] !== $turn) continue;
            $hasOwn = true;
            if ($hasMove) continue;
            $isKing = !empty($p['king']);
            $forward = ($turn === 'white') ? -1 : 1;
            $dirs = $isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[$forward,-1],[$forward,1]];
            foreach ($dirs as [$dr, $dc]) {
                $nr = $r + $dr; $nc = $c + $dc;
                if ($nr>=0&&$nr<BOARD_N&&$nc>=0&&$nc<BOARD_N && $board[$nr][$nc] === null) {
                    $hasMove = true; break;
                }
            }
            if (!$hasMove && damas_piece_can_capture($board, $r, $c)) $hasMove = true;
        }
    }
    if (!$hasOwn || !$hasMove) {
        return $turn === 'white' ? 'black' : 'white';
    }
    return null;
}

function leave_salao(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    if ($id === null) return ['ok' => true];

    return with_lock($dir, function (array $state) use ($id) {
        $state = release_seat_if_any($state, $id);
        unset($state['players'][$id]);
        return [$state, ['ok' => true]];
    });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function with_lock(string $dir, callable $fn): array
{
    $fp = fopen($dir . '/.lock', 'c');
    if ($fp !== false) flock($fp, LOCK_EX);
    try {
        $state = gc(read_state($dir . '/salao.json'));
        [$state, $resp] = $fn($state);
        write_json($dir . '/salao.json', $state);
        return $resp;
    } finally {
        if ($fp !== false) { flock($fp, LOCK_UN); fclose($fp); }
    }
}

function read_state(string $path): array
{
    $default = ['players' => [], 'matches' => []];
    if (!is_file($path)) return $default;
    $d = json_decode((string)file_get_contents($path), true);
    if (!is_array($d)) return $default;
    if (!isset($d['players']) || !is_array($d['players'])) $d['players'] = [];
    if (!isset($d['matches']) || !is_array($d['matches'])) $d['matches'] = [];
    return $d;
}

function gc(array $state): array
{
    $now = time();
    // remove jogadores ofline
    foreach ($state['players'] as $id => $p) {
        if (($now - ($p['ts'] ?? 0)) > PLAYER_TTL) {
            $state = release_seat_if_any($state, $id);
            unset($state['players'][$id]);
        }
    }
    // remove partidas terminadas há mais de 8s (já mostrou tela de vitória)
    foreach ($state['matches'] as $tid => $m) {
        if (($m['winner'] ?? null) !== null && ($now - ($m['endedAt'] ?? 0)) > 8) {
            unset($state['matches'][$tid]);
        }
    }
    return $state;
}

// libera assento de um jogador (uso em GC quando jogador some) e remove match associado
function release_seat_if_any(array $state, string $playerId): array
{
    $p = $state['players'][$playerId] ?? null;
    if ($p === null || empty($p['seat'])) return $state;
    [$tid, $sidx] = explode(':', $p['seat'], 2);
    // se tinha match ativa, oponente vence
    if (isset($state['matches'][$tid]) && ($state['matches'][$tid]['winner'] ?? null) === null) {
        $m = $state['matches'][$tid];
        $loserColor = ($sidx === '0') ? 'white' : 'black';
        $winnerColor = $loserColor === 'white' ? 'black' : 'white';
        $m['winner'] = $winnerColor;
        $m['reason'] = 'forfeit';
        $m['endedAt'] = time();
        $state['matches'][$tid] = $m;
    }
    return $state;
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

function rand_skin(array $players): int
{
    // distribui cores tentando variar dos vizinhos
    $usadas = [];
    foreach ($players as $p) $usadas[$p['skin'] ?? 0] = ($usadas[$p['skin'] ?? 0] ?? 0) + 1;
    $best = 0; $menor = PHP_INT_MAX;
    for ($i = 0; $i < 8; $i++) {
        $c = $usadas[$i] ?? 0;
        if ($c < $menor) { $menor = $c; $best = $i; }
    }
    return $best;
}

function clean_id($v): ?string { $v = (string)$v; return preg_match('/^[a-f0-9]{6,32}$/', $v) ? $v : null; }
function clean_name($v): string {
    $v = trim((string)$v);
    $v = preg_replace('/\s+/u', ' ', $v);
    $v = preg_replace('/[^\p{L}\p{N} _.-]/u', '', $v);
    return mb_substr($v, 0, MAX_NAME);
}
function clean_float($v, float $min, float $max): float {
    $v = is_numeric($v) ? (float)$v : 0.0;
    if ($v < $min) $v = $min;
    if ($v > $max) $v = $max;
    return $v;
}

function err(string $msg, int $code = 200): array
{
    if ($code !== 200) http_response_code($code);
    return ['error' => $msg];
}
