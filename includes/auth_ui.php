<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/** Cabeçalho das páginas de conta (mesmo visual do site). */
function jubis_ui_head(string $title): void
{
    jubis_session_start();
    $me = jubis_current_username();
    $coins = 0;
    if ($me) { $u = jubis_load_user($me); $coins = $u ? jubis_coins($u) : 0; }
    ?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0a0a1f" />
  <title><?= jubis_e($title) ?> — Jubis Games</title>
  <link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Rubik:wght@400;600;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/style.css" />
  <style>
    /* área de conta — usa as variáveis do tema */
    .acc-wrap { max-width: 460px; margin: 0 auto; padding: 28px 18px 60px; }
    .acc-card { background: linear-gradient(180deg, var(--bg-2), #0c0a22);
      border: 1px solid rgba(255,255,255,.12); border-radius: var(--radius);
      padding: 26px 24px; box-shadow: 0 18px 50px rgba(0,0,0,.45); }
    .acc-card h1 { font-family: var(--font-display); font-size: 18px; line-height: 1.5; margin: 0 0 6px; }
    .acc-card p.sub { color: var(--muted); margin: 0 0 18px; font-size: 15px; }
    .acc-field { margin: 0 0 14px; }
    .acc-field label { display: block; font-weight: 700; margin: 0 0 6px; font-size: 14px; }
    .acc-field input { width: 100%; padding: 12px 14px; border-radius: 12px; font-size: 16px;
      border: 1px solid rgba(255,255,255,.18); background: #0a0820; color: var(--ink); }
    .acc-field input:focus { outline: none; border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(0,240,255,.2); }
    .acc-field .hint { color: var(--muted); font-size: 12px; margin-top: 5px; }
    .acc-btn { display: block; width: 100%; margin-top: 8px; border: none; cursor: pointer;
      padding: 14px 18px; border-radius: 14px; font-weight: 800; font-size: 16px; color: #06121f;
      background: linear-gradient(90deg, var(--cyan), #38d9ff); box-shadow: 0 8px 24px -8px rgba(0,240,255,.7); }
    .acc-btn:active { transform: translateY(1px); }
    .acc-alt { text-align: center; margin-top: 16px; color: var(--muted); font-size: 14px; }
    .acc-alt a { color: var(--cyan); font-weight: 700; }
    .acc-msg { border-radius: 12px; padding: 11px 14px; margin: 0 0 16px; font-size: 14px; font-weight: 600; }
    .acc-msg.err { background: rgba(255,43,124,.14); border: 1px solid rgba(255,43,124,.5); color: #ffc2d8; }
    .acc-msg.ok  { background: rgba(120,255,140,.12); border: 1px solid rgba(120,255,140,.45); color: #c8ffd2; }
    .coin-box { display: flex; align-items: center; gap: 14px; background: #0a0820;
      border: 1px solid rgba(255,210,63,.4); border-radius: 16px; padding: 16px 18px; margin: 6px 0 18px; }
    .coin-box .coin { font-size: 38px; }
    .coin-box .amt { font-family: var(--font-display); font-size: 22px; color: var(--yellow); }
    .coin-box .lbl { color: var(--muted); font-size: 13px; }
    .acc-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .acc-actions a { flex: 1; text-align: center; padding: 12px; border-radius: 12px; font-weight: 700;
      border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.04); }
    .pill-coin { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,210,63,.16);
      border: 1px solid rgba(255,210,63,.4); color: var(--yellow); padding: 4px 10px; border-radius: 999px; font-weight: 800; }
  </style>
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <header class="site-header">
    <a class="logo" href="index.php" aria-label="Jubis Games — início">
      <span class="logo__icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="40" height="40">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#00f0ff"/><stop offset="100%" stop-color="#ff2bd6"/>
          </linearGradient></defs>
          <rect x="6" y="18" width="52" height="32" rx="10" fill="url(#lg)"/>
          <circle cx="20" cy="34" r="4" fill="#0a0a1f"/><circle cx="44" cy="34" r="4" fill="#0a0a1f"/>
          <rect x="14" y="28" width="3" height="12" fill="#0a0a1f"/><rect x="8" y="32" width="15" height="3" fill="#0a0a1f"/>
        </svg>
      </span>
      <span class="logo__text"><span class="logo__brand">JUBIS</span><span class="logo__brand logo__brand--accent">GAMES</span></span>
    </a>
    <nav class="nav">
      <a href="index.php#jogos">Jogos</a>
      <?php if ($me): ?>
        <a href="conta.php" class="pill-coin">🪙 <?= (int)$coins ?></a>
        <a href="sair.php">Sair</a>
      <?php else: ?>
        <a href="entrar.php">Entrar</a>
      <?php endif; ?>
    </nav>
  </header>
  <main>
    <div class="acc-wrap">
<?php
}

function jubis_ui_foot(): void
{
    $year = date('Y');
    ?>
    </div>
  </main>
  <footer class="site-footer">
    <p>© <?= $year ?> Jubis Games · Feito com 💜 por João</p>
  </footer>
</body>
</html>
<?php
}
