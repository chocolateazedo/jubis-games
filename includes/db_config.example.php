<?php
// MODELO de configuração do banco. Copie para "db_config.local.php" e preencha
// com a URL real (esse arquivo .local é gitignored e NÃO vai pro repositório).
//
// Em produção, o ideal é definir a variável de ambiente JUBIS_DATABASE_URL
// no servidor, em vez de subir esse arquivo.
//
// Formato (MySQL — mesmo banco do Top Terapia): mysql://usuario:senha@host:porta/banco
// Ex.: mysql://top:SENHA@localhost:3306/top
return 'mysql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO';
