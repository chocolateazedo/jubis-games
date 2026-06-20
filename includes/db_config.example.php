<?php
// MODELO de configuração do banco. Copie para "db_config.local.php" e preencha
// com a URL real (esse arquivo .local é gitignored e NÃO vai pro repositório).
//
// Em produção, o ideal é definir a variável de ambiente JUBIS_DATABASE_URL
// no servidor, em vez de subir esse arquivo.
//
// Formato: postgresql://usuario:senha@host:porta/banco
return 'postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO';
