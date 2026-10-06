#!/bin/sh
# Rewrites the Compose hostnames in prometheus.yml to the platform's internal
# host:port for each service when the *_HOSTPORT variables are set.
set -e
sed \
  -e "s|backend:8080|${BACKEND_HOSTPORT:-backend:8080}|" \
  -e "s|user-service:8081|${USER_SERVICE_HOSTPORT:-user-service:8081}|" \
  -e "s|order-service:8082|${ORDER_SERVICE_HOSTPORT:-order-service:8082}|" \
  -e "s|payment-service:8083|${PAYMENT_SERVICE_HOSTPORT:-payment-service:8083}|" \
  -e "s|inventory-service:8084|${INVENTORY_SERVICE_HOSTPORT:-inventory-service:8084}|" \
  /etc/prometheus/prometheus.yml.tmpl > /tmp/prometheus.yml
exec /bin/prometheus --config.file=/tmp/prometheus.yml --storage.tsdb.path=/prometheus
