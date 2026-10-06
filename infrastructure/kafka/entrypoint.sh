#!/bin/sh
# Advertise the container's private IP so other services on the platform's
# private network can reach the broker after the bootstrap connection.
set -e
ip=$(hostname -i | awk '{print $1}')
export KAFKA_ADVERTISED_LISTENERS="PLAINTEXT://${ip}:29092"
exec /etc/kafka/docker/run
