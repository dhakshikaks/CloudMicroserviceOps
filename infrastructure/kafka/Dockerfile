# Used by render.yaml: single-node KRaft broker reachable on the private network.
FROM apache/kafka:3.8.0
COPY entrypoint.sh /opt/cloudops-kafka-entrypoint.sh
ENV KAFKA_NODE_ID=1 \
    KAFKA_PROCESS_ROLES=broker,controller \
    KAFKA_LISTENERS=PLAINTEXT://:29092,CONTROLLER://:29093 \
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
    KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
    KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:29093 \
    KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT \
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
    KAFKA_AUTO_CREATE_TOPICS_ENABLE=true \
    CLUSTER_ID=cloudopskafkacluster01
EXPOSE 29092
ENTRYPOINT ["/bin/sh", "/opt/cloudops-kafka-entrypoint.sh"]
