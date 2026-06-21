<?php
declare(strict_types=1);
// API de persistência das construções do Bosque VR.
// Usa o mesmo PostgreSQL da área logada, no schema "jubis" (isolado).
// GET  -> { ok, buildings:[...], user, csrf }   (lista tudo; informa se está logado)
// POST -> salva uma peça { piece, x, y, z, ry } (precisa estar logado + CSRF)
// DELETE?id=N -> remove uma peça do próprio usuário

require_once __DIR__ . '/../../includes/auth.php'; // já puxa db.php
jubis_session_start();
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = jubis_db();
    // cria a tabela na primeira chamada (idempotente)
    $pdo->exec(
        'create table if not exists jubis.buildings (
            id         bigserial   primary key,
            user_id    bigint      references jubis.users(id) on delete set null,
            username   text        not null default \'\',
            piece      text        not null,
            x          real        not null,
            y          real        not null,
            z          real        not null,
            ry         real        not null default 0,
            created_at timestamptz not null default now()
        )'
    );

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $rows = $pdo->query('select id, username, piece, x, y, z, ry from jubis.buildings order by id')
                    ->fetchAll(PDO::FETCH_ASSOC);
        $user = jubis_current_user();
        echo json_encode([
            'ok'        => true,
            'buildings' => $rows,
            'user'      => $user ? $user['username'] : null,
            'csrf'      => $user ? jubis_csrf_token() : null,
        ]);
        exit;
    }

    if ($method === 'POST') {
        $user = jubis_current_user();
        if (!$user) { http_response_code(401); echo json_encode(['ok' => false, 'error' => 'login']); exit; }

        $in = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($in)) $in = [];

        // CSRF: token enviado no header X-CSRF
        $tok = $_SERVER['HTTP_X_CSRF'] ?? '';
        if (!jubis_csrf_check(is_string($tok) ? $tok : '')) {
            http_response_code(403); echo json_encode(['ok' => false, 'error' => 'csrf']); exit;
        }

        $piece = preg_replace('/[^a-z0-9\-]/', '', strtolower((string)($in['piece'] ?? '')));
        if ($piece === '') { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'piece']); exit; }
        $x = (float)($in['x'] ?? 0); $y = (float)($in['y'] ?? 0); $z = (float)($in['z'] ?? 0); $ry = (float)($in['ry'] ?? 0);
        // sanidade: dentro de um raio razoável do mundo
        if (abs($x) > 400 || abs($z) > 400 || abs($y) > 200) { http_response_code(400); echo json_encode(['ok' => false, 'error' => 'range']); exit; }

        $st = $pdo->prepare('insert into jubis.buildings (user_id, username, piece, x, y, z, ry) values (?,?,?,?,?,?,?) returning id');
        $st->execute([$user['id'], $user['username'], $piece, $x, $y, $z, $ry]);
        echo json_encode(['ok' => true, 'id' => (int)$st->fetchColumn()]);
        exit;
    }

    if ($method === 'DELETE') {
        $user = jubis_current_user();
        if (!$user) { http_response_code(401); echo json_encode(['ok' => false, 'error' => 'login']); exit; }
        $id = (int)($_GET['id'] ?? 0);
        $st = $pdo->prepare('delete from jubis.buildings where id = ? and user_id = ?');
        $st->execute([$id, $user['id']]);
        echo json_encode(['ok' => true, 'deleted' => $st->rowCount()]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server']);
}
