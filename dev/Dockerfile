# Imagem de desenvolvimento do Jubis Games: PHP CLI + PostgreSQL (pdo_pgsql)
# (a hospedagem de produção precisa ter a extensão pdo_pgsql habilitada também)
FROM php:8.2-cli
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql pgsql \
 && rm -rf /var/lib/apt/lists/*
