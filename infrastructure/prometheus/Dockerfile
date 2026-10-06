# Used by render.yaml. Docker Compose mounts prometheus.yml directly instead.
FROM prom/prometheus:v2.54.1
COPY prometheus.yml /etc/prometheus/prometheus.yml.tmpl
COPY entrypoint.sh /etc/prometheus/entrypoint.sh
ENTRYPOINT ["/bin/sh", "/etc/prometheus/entrypoint.sh"]
