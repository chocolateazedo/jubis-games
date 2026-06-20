<?php
declare(strict_types=1);
require __DIR__ . '/includes/auth_ui.php';
jubis_session_start();
if (jubis_is_logged_in()) { header('Location: conta.php'); exit; }

$err = '';
$username = '';
$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = (string)($_POST['username'] ?? '');
    $email    = (string)($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    if (!jubis_csrf_check($_POST['csrf'] ?? null)) {
        $err = 'Sua sessão expirou. Tente enviar de novo.';
    } else {
        $r = jubis_signup($username, $password, $email);
        if (!empty($r['ok'])) {
            jubis_login($username, $password); // entra direto após criar
            header('Location: conta.php');
            exit;
        }
        $err = $r['error'] ?? 'Não foi possível criar a conta.';
    }
}

jubis_ui_head('Criar conta');
?>
<div class="acc-card">
  <h1>Criar conta 🎮</h1>
  <p class="sub">Crie sua conta para juntar <strong>Jubis Coins</strong> jogando!</p>

  <?php if ($err): ?><div class="acc-msg err"><?= jubis_e($err) ?></div><?php endif; ?>

  <form method="post" autocomplete="on">
    <input type="hidden" name="csrf" value="<?= jubis_e(jubis_csrf_token()) ?>" />
    <div class="acc-field">
      <label for="username">Nome de usuário</label>
      <input id="username" name="username" value="<?= jubis_e($username) ?>" maxlength="20" required
             autocapitalize="none" autocomplete="username" placeholder="ex.: joao_craque" />
      <div class="hint">3 a 20 caracteres: letras, números ou _</div>
    </div>
    <div class="acc-field">
      <label for="email">E-mail <span style="opacity:.6">(opcional)</span></label>
      <input id="email" name="email" type="email" value="<?= jubis_e($email) ?>" autocomplete="email" placeholder="pra recuperar a conta no futuro" />
    </div>
    <div class="acc-field">
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" minlength="6" required
             autocomplete="new-password" placeholder="mínimo 6 caracteres" />
    </div>
    <button class="acc-btn" type="submit">Criar minha conta</button>
  </form>

  <p class="acc-alt">Já tem conta? <a href="entrar.php">Entrar</a></p>
</div>
<?php jubis_ui_foot(); ?>
