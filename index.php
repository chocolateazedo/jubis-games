<?php
declare(strict_types=1);

require __DIR__ . '/includes/games.php';

$games = jubis_load_games(__DIR__ . '/games');
$year  = date('Y');

function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0a0a1f" />
  <meta name="description" content="Jubis Games — jogos criados pelo João! Diversão, aventura e desafios para todas as idades." />
  <title>Jubis Games — Jogue agora!</title>
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@400;600;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/style.css" />

  <!-- Open Graph -->
  <meta property="og:title" content="Jubis Games" />
  <meta property="og:description" content="Jogos criados pelo João — joga direto no navegador!" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://jubis-games.cloud" />
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-blobs" aria-hidden="true">
    <span class="blob blob--cyan"></span>
    <span class="blob blob--magenta"></span>
    <span class="blob blob--lime"></span>
  </div>

  <header class="site-header">
    <a class="logo" href="#top" aria-label="Jubis Games — início">
      <span class="logo__icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="44" height="44">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#00f0ff"/>
              <stop offset="100%" stop-color="#ff2bd6"/>
            </linearGradient>
          </defs>
          <rect x="6" y="18" width="52" height="32" rx="10" fill="url(#lg)"/>
          <circle cx="20" cy="34" r="4" fill="#0a0a1f"/>
          <circle cx="44" cy="34" r="4" fill="#0a0a1f"/>
          <rect x="14" y="28" width="3" height="12" fill="#0a0a1f"/>
          <rect x="8" y="32" width="15" height="3" fill="#0a0a1f"/>
        </svg>
      </span>
      <span class="logo__text">
        <span class="logo__brand">JUBIS</span>
        <span class="logo__brand logo__brand--accent">GAMES</span>
      </span>
    </a>

    <nav class="nav">
      <a href="#jogos">Jogos</a>
      <a href="#sobre">Sobre</a>
    </nav>
  </header>

  <main id="top">
    <section class="hero">
      <div class="hero__inner">
        <p class="hero__eyebrow"><span class="dot"></span> Insira moeda para começar</p>
        <h1 class="hero__title">
          Bem-vindo ao
          <span class="hero__brand">Jubis Games</span>
        </h1>
        <p class="hero__lead">
          Jogos feitos com muita criatividade pelo <strong>João</strong>. Escolha uma aventura, aperte
          <kbd>jogar</kbd> e divirta-se!
        </p>
        <div class="hero__cta">
          <a href="#jogos" class="btn btn--primary">▶ Ver Jogos</a>
          <a href="#sobre" class="btn btn--ghost">Sobre o estúdio</a>
        </div>
        <p class="hero__counter">
          <strong><?= count($games) ?></strong> <?= count($games) === 1 ? 'jogo disponível' : 'jogos disponíveis' ?>
        </p>
      </div>

      <div class="hero__art" aria-hidden="true">
        <div class="console">
          <div class="console__screen">
            <span class="console__pixel console__pixel--1"></span>
            <span class="console__pixel console__pixel--2"></span>
            <span class="console__pixel console__pixel--3"></span>
            <span class="console__pixel console__pixel--4"></span>
            <span class="console__text">PLAYER 1<br/>READY</span>
          </div>
          <div class="console__btns">
            <span class="console__btn console__btn--a">A</span>
            <span class="console__btn console__btn--b">B</span>
          </div>
        </div>
      </div>
    </section>

    <section id="jogos" class="games">
      <header class="section-head">
        <h2>Catálogo de jogos</h2>
      </header>

      <?php if (empty($games)): ?>
        <p class="games__empty">
          Ainda não há jogos publicados. Volte em breve! ⏳
        </p>
      <?php else: ?>
        <div class="games__grid">
          <?php foreach ($games as $game): ?>
            <a class="game-card" href="<?= e($game['url']) ?>">
              <div class="game-card__cover">
                <?php if ($game['cover']): ?>
                  <img src="<?= e($game['cover']) ?>" alt="" loading="lazy" />
                <?php else: ?>
                  <span class="game-card__emoji" aria-hidden="true"><?= e($game['emoji']) ?></span>
                <?php endif; ?>
                <span class="game-card__play">▶ Jogar</span>
              </div>
              <div class="game-card__body">
                <h3 class="game-card__title"><?= e($game['title']) ?></h3>
                <?php if (!empty($game['tags'])): ?>
                  <ul class="game-card__tags">
                    <?php foreach ($game['tags'] as $tag): ?>
                      <li><?= e($tag) ?></li>
                    <?php endforeach; ?>
                  </ul>
                <?php endif; ?>
              </div>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>


    <section class="quick-questions" aria-labelledby="perguntas-rapidas">
      <div class="about__card">
        <h2 id="perguntas-rapidas">2 perguntas rápidas</h2>
        <p>Antes de ativar novidades (como VIP), responde rapidinho:</p>
        <ol class="about__list">
          <li>Qual jogo você mais gostou no Jubis Games?</li>
          <li>Você pagaria <strong>US$ 5,00 por mês</strong> para ter acesso VIP?</li>
        </ol>
      </div>
    </section>

    <section id="sobre" class="about">
      <div class="about__card">
        <h2>Sobre o Jubis Games</h2>
        <p>
          O <strong>Jubis Games</strong> é o estúdio do <strong>João</strong>! Aqui ele publica os
          jogos que cria — todos feitos em <em>HTML</em>, prontos para jogar direto no navegador,
          sem download e sem complicação.
        </p>
        <ul class="about__list">
          <li>🎮 Feito por uma criança, para todo mundo</li>
          <li>🚀 Roda no celular, tablet e computador</li>
          <li>🛡️ Sem anúncios, sem cadastro, sem enrolação</li>
        </ul>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>© <?= $year ?> Jubis Games · Feito com 💜 por João · <a href="https://jubis-games.cloud">jubis-games.cloud</a></p>
  </footer>

  <script src="assets/js/main.js" defer></script>
</body>
</html>
