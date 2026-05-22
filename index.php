<?php
declare(strict_types=1);

require __DIR__ . '/includes/games.php';

$games = jubis_load_games(__DIR__ . '/games');
$year = date('Y');

$worlds = [
    'Todos' => fn(array $game): bool => true,
    'Aventura' => fn(array $game): bool => in_array('aventura', array_map('mb_strtolower', $game['tags']), true),
    'Clássicos' => fn(array $game): bool => preg_match('/(xadrez|damas|velha|packman)/iu', $game['title']) === 1,
    'Ação' => fn(array $game): bool => preg_match('/(runner|zumbi|martelo|bloco|blast)/iu', $game['title']) === 1,
    'Criativos' => fn(array $game): bool => preg_match('/(desenho|ingles|stop|jardim|bichinhos)/iu', $game['title']) === 1,
];

function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jubis Worlds</title>
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg" />
  <link rel="stylesheet" href="assets/css/style.css" />
</head>
<body data-image-id="2ca166e5-d4cc-4855-ae66-a0b3e18ed420">
  <main class="worlds">
    <section class="hero-photo" aria-label="Visual principal">
      <img
        id="heroImage"
        src="https://images.openai.com/blob/2ca166e5-d4cc-4855-ae66-a0b3e18ed420"
        alt="Foto principal do Jubis Worlds"
        loading="eager"
      />
      <div class="hero-overlay">
        <h1>JUBIS WORLDS</h1>
        <p>Escolha um mundo e bora jogar.</p>
      </div>
    </section>

    <nav class="world-menu" aria-label="Menu de mundos">
      <?php foreach (array_keys($worlds) as $index => $world): ?>
        <button class="world-btn<?= $index === 0 ? ' is-active' : '' ?>" data-world="<?= e($world) ?>"><?= e($world) ?></button>
      <?php endforeach; ?>
    </nav>

    <section class="world-grid" id="worldGrid">
      <?php foreach ($games as $game): ?>
        <?php
          $bucket = 'Todos';
          foreach ($worlds as $world => $rule) {
              if ($world !== 'Todos' && $rule($game)) {
                  $bucket = $world;
                  break;
              }
          }
        ?>
        <a class="game-tile" data-world="<?= e($bucket) ?>" href="<?= e($game['url']) ?>">
          <span class="tile-world"><?= e($bucket) ?></span>
          <h2><?= e($game['title']) ?></h2>
          <p><?= e($game['description'] ?: 'Entre nesse mundo e descubra o desafio.') ?></p>
          <span class="play">Jogar agora →</span>
        </a>
      <?php endforeach; ?>
    </section>
  </main>

  <footer>© <?= e($year) ?> Jubis Games</footer>
  <script src="assets/js/main.js" defer></script>
</body>
</html>
