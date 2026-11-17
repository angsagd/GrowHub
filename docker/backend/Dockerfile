FROM php:8.4-cli

COPY --from=mlocati/php-extension-installer:2.7 /usr/bin/install-php-extensions /usr/local/bin/
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/* \
    && install-php-extensions pdo_pgsql pgsql intl zip gd bcmath pcntl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY php.ini /usr/local/etc/php/conf.d/zz-growhub.ini
COPY entrypoint.sh /usr/local/bin/growhub-entrypoint
RUN chmod +x /usr/local/bin/growhub-entrypoint

WORKDIR /var/www/html
ENTRYPOINT ["growhub-entrypoint"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8001"]
