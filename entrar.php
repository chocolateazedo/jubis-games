<?php
declare(strict_types=1);
require __DIR__ . '/includes/auth_ui.php';
jubis_session_start();
if (jubis_is_logged_in()) { header('Location: conta.php'); exit; }

$err = '';
$username = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = (string)($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    if (!jubis_csrf_check($_POST['csrf'] ?? null)) {
        $err = 'Sua sessão expirou. Tente enviar de novo.';
    } else {
        $r = jubis_login($username, $password);
        if (!empty($r['ok'])) { header('Location: conta.php'); exit; }
        $err = $r['error'] ?? 'Não foi possível entrar.';
    }
}

jubis_ui_head('Entrar');
?>
<div class="acc-card">
  <h1>Entrar 🕹️</h1>
  <p class="sub">Bem-vindo de volta! Entre para ver seus Jubis Coins.</p>

  <?php if ($err): ?><div class="acc-msg err"><?= jubis_e($err) ?></div><?php endif; ?>

  <form method="post" autocomplete="on">
    <input type="hidden" name="csrf" value="<?= jubis_e(jubis_csrf_token()) ?>" />
    <div class="acc-field">
      <label for="username">Nome de usuário</label>
      <input id="username" name="username" value="<?= jubis_e($username) ?>" maxlength="20" required
             autocapitalize="none" autocomplete="username" />
    </div>
    <div class="acc-field">
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" />
    </div>
    <button class="acc-btn" type="submit">Entrar</button>
  </form>

  <p class="acc-alt">Ainda não tem conta? <a href="cadastro.php">Criar conta</a></p>
</div>
<?php jubis_ui_foot(); ?>
