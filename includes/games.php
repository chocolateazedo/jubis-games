<?php
/**
 * Jubis Games — descoberta automática de jogos.
 *
 * Cada jogo é uma pasta dentro de /games/ que contém um arquivo game.json.
 * Estrutura esperada:
 *   games/<slug>/game.json   (metadados)
 *   games/<slug>/index.html  (o jogo em si)
 *   games/<slug>/cover.png   (capa opcional, 600x400)
 *
 * Formato de game.json:
 *   {
 *     "title": "Nome do Jogo",
 *     "description": "Frase curta que aparece no cartão.",
 *     "emoji": "🚀",
 *     "tags": ["aventura", "1 jogador"],
 *     "entry": "index.html",
 *     "cover": "cover.png",
 *     "hidden": false,
 *     "order": 1
 *   }
 */

function jubis_load_games(string $gamesDir): array
{
    if (!is_dir($gamesDir)) {
        return [];
    }

    $games = [];
    foreach (scandir($gamesDir) as $entry) {
        if ($entry === '.' || $entry === '..') continue;

        $folder = $gamesDir . DIRECTORY_SEPARATOR . $entry;
        if (!is_dir($folder)) continue;

        $metaPath = $folder . DIRECTORY_SEPARATOR . 'game.json';
        if (!is_file($metaPath)) continue;

        $raw = file_get_contents($metaPath);
        $meta = json_decode($raw, true);
        if (!is_array($meta)) continue;
        if (!empty($meta['hidden'])) continue;

        $entryFile = $meta['entry'] ?? 'index.html';
        $entryPath = $folder . DIRECTORY_SEPARATOR . $entryFile;
        if (!is_file($entryPath)) continue;

        $cover = null;
        if (!empty($meta['cover'])) {
            $coverPath = $folder . DIRECTORY_SEPARATOR . $meta['cover'];
            if (is_file($coverPath)) {
                $cover = 'games/' . rawurlencode($entry) . '/' . $meta['cover'];
            }
        }

        $games[] = [
            'slug'        => $entry,
            'title'       => $meta['title'] ?? ucfirst($entry),
            'description' => $meta['description'] ?? '',
            'emoji'       => $meta['emoji'] ?? '🎮',
            'tags'        => array_values(array_filter((array)($meta['tags'] ?? []))),
            'url'         => 'games/' . rawurlencode($entry) . '/' . $entryFile,
            'cover'       => $cover,
            'order'       => isset($meta['order']) ? (int)$meta['order'] : PHP_INT_MAX,
        ];
    }

    usort($games, function ($a, $b) {
        if ($a['order'] === $b['order']) {
            return strnatcasecmp($a['title'], $b['title']);
        }
        return $a['order'] <=> $b['order'];
    });

    return $games;
}
