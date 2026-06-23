<?php
declare(strict_types=1);

/**
 * Endpoint de presença. Os jogos mandam um heartbeat aqui; a home lê as contagens.
 *   GET presence.php?game=<slug>&id=<id>   -> registra e devolve {"count": N}
 *   GET presence.php?game=<slug>&id=<id>&leave=1 -> sai da contagem
 *   GET presence.php?all=1                 -> {"counts": { "<slug>": N, ... }}
 */

require_once __DIR__ . '/includes/presence.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$slug = (string)($_GET['game'] ?? $_POST['game'] ?? '');
$id   = (string)($_GET['id']   ?? $_POST['id']   ?? '');

try {
    if (!empty($_GET['all'])) {
        echo json_encode(['counts' => jubis_presence_counts()]);
    } elseif (!empty($_GET['leave']) || !empty($_POST['leave'])) {
        jubis_presence_leave($slug, $id);
        echo json_encode(['ok' => true]);
    } else {
        echo json_encode(['count' => jubis_presence_ping($slug, $id)]);
    }
} catch (Throwable $e) {
    echo json_encode(['count' => 0]);
}
