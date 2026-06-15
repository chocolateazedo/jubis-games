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

$DATA = __DIR__ . '/data';
ensure_data_dir($DATA);

$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = (string)($input['action'] ?? ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'join':    echo json_encode(join_salao($DATA, $input)); break;
        case 'update':  echo json_encode(update_salao($DATA, $input)); break;
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
            'z'    => 8.0,                              // entra pela porta (z grande)
            'rot'  => 3.14159,                          // virado pro centro
            'skin' => $skin,
            'ts'   => time(),
        ];
        return [$state, ['id' => $id, 'skin' => $skin]];
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
        $p['x']  = clean_float($in['x'] ?? $p['x'], -50, 50);
        $p['y']  = clean_float($in['y'] ?? $p['y'], -5, 5);
        $p['z']  = clean_float($in['z'] ?? $p['z'], -50, 50);
        $p['rot']= clean_float($in['rot'] ?? $p['rot'], -10, 10);
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
            ];
        }
        return [$state, ['players' => $players]];
    });
}

function leave_salao(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    if ($id === null) return ['ok' => true];

    return with_lock($dir, function (array $state) use ($id) {
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
    $default = ['players' => []];
    if (!is_file($path)) return $default;
    $d = json_decode((string)file_get_contents($path), true);
    if (!is_array($d)) return $default;
    if (!isset($d['players']) || !is_array($d['players'])) $d['players'] = [];
    return $d;
}

function gc(array $state): array
{
    $now = time();
    foreach ($state['players'] as $id => $p) {
        if (($now - ($p['ts'] ?? 0)) > PLAYER_TTL) {
            unset($state['players'][$id]);
        }
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
