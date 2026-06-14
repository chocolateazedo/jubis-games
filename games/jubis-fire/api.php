<?php
declare(strict_types=1);

/**
 * Jubis Fire — lobby/matchmaking (Jubis Games).
 *
 * Hospedagem é estática + PHP (sem WebSocket): este backend só agrupa jogadores
 * em salas (até 4), elege um host (o primeiro a entrar) e distribui os PeerJS
 * IDs. A partida em si roda em WebRTC P2P direto entre os navegadores.
 *
 * Estado em rooms.json (lista pequena de salas) protegido por flock.
 * Todas as chamadas são POST JSON: { "action": "...", ... }
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_PLAYERS = 4;
const PLAYER_TTL  = 12;     // segundos sem dar sinal -> jogador sai da sala (no lobby)
const ROOM_TTL    = 7200;   // remove salas inativas após 2h

$DATA = __DIR__ . '/data';
ensure_data_dir($DATA);

$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'quick_join':  echo json_encode(quick_join($DATA, $input)); break;
        case 'create_room': echo json_encode(create_room($DATA, $input)); break;
        case 'join_room':   echo json_encode(join_room($DATA, $input)); break;
        case 'room':        echo json_encode(room_state($DATA, $input)); break;
        case 'start':       echo json_encode(start_room($DATA, $input)); break;
        case 'leave':       echo json_encode(leave_room($DATA, $input)); break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'ação inválida']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'erro interno']);
}

// ----------------------------------------------------------------------------

function quick_join(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    $char = clean_char($in['char'] ?? '');
    $map = clean_map($in['map'] ?? '');
    if ($name === '' || $peer === null) return err('dados inválidos');

    return with_lock($dir, function (array $rooms) use ($name, $peer, $char, $map) {
        // procura sala pública aberta, com vaga e mesmo mapa
        foreach ($rooms as &$r) {
            if (($r['code'] ?? null) === null && $r['status'] === 'waiting' && ($r['map'] ?? 'backrooms') === $map && count($r['players']) < MAX_PLAYERS) {
                $r['players'][] = mkplayer($name, $peer, $char);
                $r['updatedAt'] = time();
                return [$rooms, ['roomId' => $r['id'], 'isHost' => false]];
            }
        }
        unset($r);
        // nenhuma: cria nova como host
        $room = mkroom(null, $name, $peer, $char, $map);
        $rooms[$room['id']] = $room;
        return [$rooms, ['roomId' => $room['id'], 'isHost' => true]];
    });
}

function create_room(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    $char = clean_char($in['char'] ?? '');
    $map = clean_map($in['map'] ?? '');
    if ($name === '' || $peer === null) return err('dados inválidos');

    return with_lock($dir, function (array $rooms) use ($name, $peer, $char, $map) {
        do { $code = random_code(6); } while (room_by_code($rooms, $code) !== null);
        $room = mkroom($code, $name, $peer, $char, $map);
        $rooms[$room['id']] = $room;
        return [$rooms, ['roomId' => $room['id'], 'code' => $code, 'isHost' => true]];
    });
}

function join_room(string $dir, array $in): array
{
    $name = clean_name($in['name'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    $char = clean_char($in['char'] ?? '');
    $code = (string)($in['code'] ?? '');
    if ($name === '' || $peer === null) return err('dados inválidos');
    if (!preg_match('/^[A-Za-z0-9]{6}$/', $code)) return err('senha inválida');

    return with_lock($dir, function (array $rooms) use ($name, $peer, $char, $code) {
        $id = room_by_code($rooms, $code);
        if ($id === null) return [$rooms, err('sala não encontrada ou expirada')];
        $r = &$rooms[$id];
        if ($r['status'] !== 'waiting') return [$rooms, err('a partida já começou')];
        if (count($r['players']) >= MAX_PLAYERS) return [$rooms, err('sala cheia')];
        $r['players'][] = mkplayer($name, $peer, $char);
        $r['updatedAt'] = time();
        return [$rooms, ['roomId' => $id, 'isHost' => false]];
    });
}

function room_state(string $dir, array $in): array
{
    $id   = clean_id($in['roomId'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    if ($id === null) return err('sala inválida', 400);

    return with_lock($dir, function (array $rooms) use ($id, $peer) {
        if (!isset($rooms[$id])) return [$rooms, err('sala não encontrada ou expirada', 404)];
        $r = &$rooms[$id];
        // heartbeat do jogador (só enquanto esperando)
        if ($r['status'] === 'waiting' && $peer !== null) {
            foreach ($r['players'] as &$p) if ($p['peerId'] === $peer) $p['ts'] = time();
            unset($p);
        }
        return [$rooms, [
            'status'  => $r['status'],
            'code'    => $r['code'],
            'map'     => $r['map'] ?? 'backrooms',
            'players' => array_map(fn($p) => ['name' => $p['name'], 'peerId' => $p['peerId'], 'char' => $p['char']], $r['players']),
        ]];
    });
}

function start_room(string $dir, array $in): array
{
    $id   = clean_id($in['roomId'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    if ($id === null) return err('sala inválida', 400);

    return with_lock($dir, function (array $rooms) use ($id, $peer) {
        if (!isset($rooms[$id])) return [$rooms, err('sala não encontrada', 404)];
        $r = &$rooms[$id];
        if (($r['players'][0]['peerId'] ?? '') !== $peer) return [$rooms, err('só o host pode iniciar', 403)];
        if (count($r['players']) < 2) return [$rooms, err('precisa de pelo menos 2 jogadores')];
        $r['status'] = 'started';
        $r['updatedAt'] = time();
        return [$rooms, ['ok' => true]];
    });
}

function leave_room(string $dir, array $in): array
{
    $id   = clean_id($in['roomId'] ?? '');
    $peer = clean_peer($in['peerId'] ?? '');
    if ($id === null) return ['ok' => true];

    return with_lock($dir, function (array $rooms) use ($id, $peer) {
        if (isset($rooms[$id])) {
            $r = &$rooms[$id];
            if ($r['status'] === 'waiting') {
                $r['players'] = array_values(array_filter($r['players'], fn($p) => $p['peerId'] !== $peer));
                if (count($r['players']) === 0) unset($rooms[$id]);
            }
        }
        return [$rooms, ['ok' => true]];
    });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function mkroom(?string $code, string $name, string $peer, string $char, string $map = 'backrooms'): array
{
    return [
        'id'        => bin2hex(random_bytes(6)),
        'code'      => $code,
        'map'       => $map,
        'status'    => 'waiting',
        'players'   => [mkplayer($name, $peer, $char)],
        'createdAt' => time(),
        'updatedAt' => time(),
    ];
}

function mkplayer(string $name, string $peer, string $char): array
{
    return ['name' => $name, 'peerId' => $peer, 'char' => $char, 'ts' => time()];
}

function room_by_code(array $rooms, string $code): ?string
{
    foreach ($rooms as $id => $r) if (($r['code'] ?? null) === $code) return (string)$id;
    return null;
}

/**
 * Lê rooms.json, roda o GC, chama $fn($rooms) que devolve [novoRooms, resposta],
 * grava e retorna a resposta. Tudo sob flock.
 */
function with_lock(string $dir, callable $fn): array
{
    $fp = fopen($dir . '/.lock', 'c');
    if ($fp !== false) flock($fp, LOCK_EX);
    try {
        $rooms = gc(read_json($dir . '/rooms.json', []));
        [$rooms, $resp] = $fn($rooms);
        write_json($dir . '/rooms.json', $rooms);
        return $resp;
    } finally {
        if ($fp !== false) { flock($fp, LOCK_UN); fclose($fp); }
    }
}

function gc(array $rooms): array
{
    $now = time();
    foreach (array_keys($rooms) as $id) {
        $r = $rooms[$id];
        if ($r['status'] === 'waiting') {
            $r['players'] = array_values(array_filter(
                $r['players'],
                fn($p) => ($now - ($p['ts'] ?? 0)) < PLAYER_TTL
            ));
            if (count($r['players']) === 0) { unset($rooms[$id]); continue; }
            $rooms[$id] = $r;
        }
        if (($now - ($r['updatedAt'] ?? 0)) > ROOM_TTL) unset($rooms[$id]);
    }
    return $rooms;
}

function read_json(string $path, $default)
{
    if (!is_file($path)) return $default;
    $d = json_decode((string)file_get_contents($path), true);
    return is_array($d) ? $d : $default;
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

function random_code(int $len): string
{
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    $m = strlen($a) - 1; $o = '';
    for ($i = 0; $i < $len; $i++) $o .= $a[random_int(0, $m)];
    return $o;
}

function clean_id($v): ?string { $v = (string)$v; return preg_match('/^[a-f0-9]{6,32}$/', $v) ? $v : null; }
function clean_peer($v): ?string { $v = (string)$v; return preg_match('/^[A-Za-z0-9_-]{1,64}$/', $v) ? $v : null; }
function clean_char($v): string { $v = (string)$v; return preg_match('/^[a-z][0-9]$/', $v) ? $v : 'm1'; }
function clean_map($v): string { return in_array($v, ['backrooms', 'bosque'], true) ? $v : 'backrooms'; }
function clean_name($v): string { $v = trim((string)$v); $v = preg_replace('/\s+/u', ' ', $v); return mb_substr($v, 0, 16); }

function err(string $msg, int $code = 200): array
{
    if ($code !== 200) http_response_code($code);
    return ['error' => $msg];
}
