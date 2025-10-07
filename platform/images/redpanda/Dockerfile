FROM redpandadata/redpanda:v23.3.14

USER root
COPY entrypoint.sh /usr/local/bin/start-redpanda.sh
RUN chmod +x /usr/local/bin/start-redpanda.sh
USER redpanda

ENTRYPOINT ["/usr/local/bin/start-redpanda.sh"]
