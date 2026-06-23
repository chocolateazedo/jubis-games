<?php
declare(strict_types=1);

/**
 * Jubis Games — presença ("quantos estão jogando agora").
 *
 * Cada jogo (no navegador) manda um "heartbeat" para presence.php a cada poucos
 * segundos. Guardamos por jogo um mapa id->timestamp em data/presence.json.
 * Quem não dá sinal de vida há mais de PRESENCE_TTL segundos é considerado fora.
 * A home (index.php) lê as contagens com jubis_presence_counts().
 */

const PRESENCE_TTL = 25; // segundos sem heartbeat -> jogador "saiu"

function jubis_presence_path(): string
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return $dir . '/presence.json';
}

function jubis_presence_clean_slug($s): string
{
    $s = (string)$s;
    return preg_match('/^[a-z0-9-]{1,40}$/', $s) ? $s : '';
}
function jubis_presence_clean_id($s): string
{
    $s = (string)$s;
    return preg_match('/^[A-Za-z0-9]{1,32}$/', $s) ? $s : '';
}

/** Abre o arquivo com lock, faz GC dos expirados, chama $fn($data) -> [$data, $ret], grava e devolve $ret. */
function jubis_presence_lock(callable $fn)
{
    $path = jubis_presence_path();
    $fp = @fopen($path, 'c+');
    if ($fp === false) { [$d, $r] = $fn(['games' => []]); return $r; }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = json_decode((string)$raw, true);
    if (!is_array($data) || !isset($data['games']) || !is_array($data['games'])) $data = ['games' => []];
    $now = time();
    foreach ($data['games'] as $g => $ids) {
        if (!is_array($ids)) { unset($data['games'][$g]); continue; }
        foreach ($ids as $id => $ts) {
            if (($now - (int)$ts) > PRESENCE_TTL) unset($data['games'][$g][$id]);
        }
        if (empty($data['games'][$g])) unset($data['games'][$g]);
    }
    [$data, $ret] = $fn($data);
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fp); flock($fp, LOCK_UN); fclose($fp);
    return $ret;
}

/** Registra um heartbeat e devolve quantos estão nesse jogo agora. */
function jubis_presence_ping(string $slug, string $id): int
{
    $slug = jubis_presence_clean_slug($slug);
    $id   = jubis_presence_clean_id($id);
    if ($slug === '' || $id === '') return 0;
    return (int) jubis_presence_lock(function (array $data) use ($slug, $id) {
        $data['games'][$slug][$id] = time();
        return [$data, count($data['games'][$slug])];
    });
}

function jubis_presence_leave(string $slug, string $id): void
{
    $slug = jubis_presence_clean_slug($slug);
    $id   = jubis_presence_clean_id($id);
    if ($slug === '' || $id === '') return;
    jubis_presence_lock(function (array $data) use ($slug, $id) {
        unset($data['games'][$slug][$id]);
        if (isset($data['games'][$slug]) && empty($data['games'][$slug])) unset($data['games'][$slug]);
        return [$data, null];
    });
}

/** Mapa slug => quantidade de jogadores ativos. */
function jubis_presence_counts(): array
{
    return (array) jubis_presence_lock(function (array $data) {
        $out = [];
        foreach ($data['games'] as $g => $ids) $out[$g] = count($ids);
        return [$data, $out];
    });
}
