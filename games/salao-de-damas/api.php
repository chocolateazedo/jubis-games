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
        return [$state, ['players' => $players]];
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
        return [$state, ['ok' => true, 'seat' => $seatKey, 'x' => $seatX, 'z' => $seatZ, 'rot' => $seatRot]];
    });
}

function stand_salao(string $dir, array $in): array
{
    $id = clean_id($in['id'] ?? '');
    if ($id === null) return err('id inválido', 400);

    return with_lock($dir, function (array $state) use ($id) {
        if (!isset($state['players'][$id])) return [$state, err('você saiu do salão')];
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
