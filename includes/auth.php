<?php
declare(strict_types=1);

/**
 * Jubis Games — autenticação e contas (área logada).
 *
 * Armazenamento em PostgreSQL (schema "jubis", compartilhado com o Top Terapia
 * porém isolado no seu próprio schema). Veja includes/db.php e includes/schema.sql.
 *
 * Aqui também ficam os helpers da moeda "Jubis Coin": o saldo já é guardado e dá
 * pra creditar/debitar com jubis_add_coins() (com extrato em jubis.coin_ledger).
 * O MECANISMO de como ganhar/usar será definido depois.
 */

require_once __DIR__ . '/db.php';

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
function jubis_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https,
    ]);
    session_name('jubis_sess');
    session_start();
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function jubis_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function jubis_csrf_token(): string
{
    jubis_session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function jubis_csrf_check(?string $token): bool
{
    jubis_session_start();
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

function jubis_valid_username(string $u): bool
{
    return (bool) preg_match('/^[a-zA-Z0-9_]{3,20}$/', $u);
}
function jubis_valid_email(string $email): bool
{
    return $email === '' || (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

// ---------------------------------------------------------------------------
// Leitura de usuário
// ---------------------------------------------------------------------------
function jubis_load_user(string $username): ?array
{
    $st = jubis_db()->prepare(
        'select id, username, pass_hash, email, jubis_coins, created_at, last_login
         from jubis_users where username_lc = :lc'
    );
    $st->execute([':lc' => strtolower(trim($username))]);
    $row = $st->fetch();
    if (!$row) return null;
    $row['id'] = (int) $row['id'];
    $row['jubis_coins'] = (int) $row['jubis_coins'];
    return $row;
}

// ---------------------------------------------------------------------------
// Cadastro / login / logout
// ---------------------------------------------------------------------------
/** Cria um usuário novo (self signup). Retorna ['ok'=>true] ou ['error'=>'...']. */
function jubis_signup(string $username, string $password, string $email = ''): array
{
    $username = trim($username);
    $email    = trim($email);

    if (!jubis_valid_username($username)) {
        return ['error' => 'Usuário deve ter de 3 a 20 letras, números ou _ (sem espaços ou acentos).'];
    }
    if (strlen($password) < 6) {
        return ['error' => 'A senha precisa ter pelo menos 6 caracteres.'];
    }
    if (!jubis_valid_email($email)) {
        return ['error' => 'E-mail inválido.'];
    }

    try {
        $st = jubis_db()->prepare(
            'insert into jubis_users (username, username_lc, pass_hash, email)
             values (:u, :lc, :h, :e)'
        );
        $st->execute([
            ':u'  => $username,
            ':lc' => strtolower($username),
            ':h'  => password_hash($password, PASSWORD_DEFAULT),
            ':e'  => $email,
        ]);
        return ['ok' => true];
    } catch (Throwable $e) {
        if ($e instanceof PDOException && $e->getCode() === '23000') { // duplicate key (MySQL)
            return ['error' => 'Esse nome de usuário já existe. Escolha outro.'];
        }
        // banco fora/não configurado etc. — não estoura 500, mostra mensagem amigável
        return ['error' => 'O sistema de contas está indisponível agora. Tente novamente em breve.'];
    }
}

/** Confere usuário+senha e inicia a sessão. Retorna ['ok'=>true] ou ['error'=>'...']. */
function jubis_login(string $username, string $password): array
{
    try {
        $user = jubis_load_user($username);
    } catch (Throwable $e) {
        // banco fora/não configurado — mensagem amigável em vez de 500
        return ['error' => 'O sistema de contas está indisponível agora. Tente novamente em breve.'];
    }
    $hash = $user['pass_hash'] ?? '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    if (!$user || !password_verify($password, $hash)) {
        usleep(250000); // pequeno atraso contra força bruta
        return ['error' => 'Usuário ou senha incorretos.'];
    }

    jubis_session_start();
    session_regenerate_id(true);
    $_SESSION['user'] = $user['username'];

    try {
        $st = jubis_db()->prepare('update jubis_users set last_login = now() where id = :id');
        $st->execute([':id' => $user['id']]);
    } catch (Throwable $e) { /* não bloqueia o login */ }

    return ['ok' => true];
}

function jubis_logout(): void
{
    jubis_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function jubis_current_username(): ?string
{
    jubis_session_start();
    $u = $_SESSION['user'] ?? null;
    return is_string($u) && $u !== '' ? $u : null;
}
function jubis_current_user(): ?array
{
    $u = jubis_current_username();
    return $u ? jubis_load_user($u) : null;
}
function jubis_is_logged_in(): bool
{
    return jubis_current_username() !== null;
}
/** Exige login; se não estiver logado, manda pra tela de entrar. */
function jubis_require_login(): array
{
    $user = jubis_current_user();
    if (!$user) { header('Location: entrar.php'); exit; }
    return $user;
}

// ---------------------------------------------------------------------------
// Jubis Coin (moeda) — saldo já funciona; como GANHAR/USAR vem depois
// ---------------------------------------------------------------------------
function jubis_coins(array $user): int
{
    return (int) ($user['jubis_coins'] ?? 0);
}

/**
 * Credita (delta>0) ou debita (delta<0) Jubis Coins de forma atômica (transação).
 * Nunca deixa o saldo negativo. Registra a movimentação em jubis.coin_ledger.
 * Retorna o usuário atualizado, ou null se não existir.
 *
 * É a base do mecanismo futuro: o "como ganhar/usar" só vai chamar isto.
 */
function jubis_add_coins(string $username, int $delta, string $reason = ''): ?array
{
    $pdo = jubis_db();
    $pdo->beginTransaction();
    try {
        $lc = strtolower(trim($username));
        // trava a linha do usuário (evita corrida em créditos/débitos simultâneos)
        $st = $pdo->prepare('select id, jubis_coins from jubis_users where username_lc = :lc for update');
        $st->execute([':lc' => $lc]);
        $row = $st->fetch();
        if (!$row) { $pdo->rollBack(); return null; }
        $uid    = (int) $row['id'];
        $newBal = max(0, (int) $row['jubis_coins'] + $delta);   // nunca negativo

        $pdo->prepare('update jubis_users set jubis_coins = :c where id = :id')
            ->execute([':c' => $newBal, ':id' => $uid]);

        if ($delta !== 0) {
            $pdo->prepare(
                'insert into jubis_coin_ledger (user_id, delta, reason, balance_after)
                 values (:uid, :d, :r, :bal)'
            )->execute([':uid' => $uid, ':d' => $delta, ':r' => $reason, ':bal' => $newBal]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return null;
    }
    return jubis_load_user($username);
}

/** Tenta gastar `amount` coins. Retorna ['ok'=>true,'user'=>...] ou ['error'=>...]. */
function jubis_spend_coins(string $username, int $amount, string $reason = ''): array
{
    if ($amount <= 0) return ['error' => 'Valor inválido.'];
    $user = jubis_load_user($username);
    if (!$user) return ['error' => 'Usuário não encontrado.'];
    if (jubis_coins($user) < $amount) return ['error' => 'Jubis Coins insuficientes.'];
    $updated = jubis_add_coins($username, -$amount, $reason);
    return $updated ? ['ok' => true, 'user' => $updated] : ['error' => 'Falha ao debitar.'];
}
