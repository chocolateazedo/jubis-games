<?php
declare(strict_types=1);

/**
 * Jubis Games — conexão com o banco (PostgreSQL, compartilhado com o Top Terapia).
 *
 * As tabelas da Jubis ficam no schema "jubis" (isolado do "public" do outro projeto).
 *
 * A URL de conexão NÃO é versionada (tem senha). Ela é lida, nesta ordem:
 *   1) variável de ambiente JUBIS_DATABASE_URL
 *   2) variável de ambiente DATABASE_URL
 *   3) arquivo includes/db_config.local.php  (gitignored — crie a partir do .example)
 *
 * Formato da URL: postgresql://usuario:senha@host:porta/banco
 */

function jubis_database_url(): string
{
    $url = getenv('JUBIS_DATABASE_URL') ?: getenv('DATABASE_URL') ?: '';
    if ($url === '') {
        foreach (['db_config.local.php', 'db_config.php'] as $f) {
            $path = __DIR__ . '/' . $f;
            if (is_file($path)) { $url = (string) require $path; break; }
        }
    }
    return $url;
}

function jubis_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $url = jubis_database_url();
    if ($url === '') {
        throw new RuntimeException('Banco não configurado: defina JUBIS_DATABASE_URL ou crie includes/db_config.local.php');
    }
    $p = parse_url($url);
    if ($p === false || empty($p['host'])) {
        throw new RuntimeException('DATABASE_URL inválida.');
    }
    $host = $p['host'];
    $port = $p['port'] ?? 5432;
    $name = ltrim($p['path'] ?? '', '/');
    $user = isset($p['user']) ? urldecode($p['user']) : '';
    $pass = isset($p['pass']) ? urldecode($p['pass']) : '';

    $dsn = "pgsql:host={$host};port={$port};dbname={$name}";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // trabalha sempre dentro do schema jubis (sem tocar no public do outro projeto)
    $pdo->exec("set search_path to jubis, public");
    return $pdo;
}

/** Cria o schema/tabelas se não existirem (idempotente). Use uma vez (ex.: setup.php). */
function jubis_db_migrate(): void
{
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    if ($sql === false) throw new RuntimeException('schema.sql não encontrado');
    jubis_db()->exec($sql);
}
