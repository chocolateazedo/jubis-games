<?php
declare(strict_types=1);
require __DIR__ . '/includes/auth_ui.php';
$user = jubis_require_login();

jubis_ui_head('Minha conta');
?>
<div class="acc-card">
  <h1>Olá, <?= jubis_e($user['username']) ?>! 👋</h1>
  <p class="sub">Esta é a sua área. Aqui ficam seus Jubis Coins.</p>

  <div class="coin-box">
    <span class="coin">🪙</span>
    <div>
      <div class="amt"><?= jubis_coins($user) ?></div>
      <div class="lbl">Jubis Coins</div>
    </div>
  </div>

  <p class="sub">Em breve você vai poder <strong>ganhar Jubis Coins</strong> jogando e
     <strong>trocar</strong> por coisas especiais. 🎁 Esse mecanismo chega já já!</p>

  <div class="acc-actions">
    <a href="index.php#jogos">🎮 Ir jogar</a>
    <a href="sair.php">Sair</a>
  </div>
</div>
<?php jubis_ui_foot(); ?>
