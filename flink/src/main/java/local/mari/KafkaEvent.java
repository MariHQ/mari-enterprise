package local.mari;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.connector.kafka.source.reader.deserializer.KafkaRecordDeserializationSchema;
import org.apache.flink.kafka.shaded.org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.flink.util.Collector;

/** Kafka envelope; the generator validates the normalized Mari change inside it. */
public class KafkaEvent implements Serializable {
  public String topic, key, value;
  public int partition;
  public long offset;
  public KafkaEvent() {}
  public KafkaEvent(String topic, String key, String value, int partition, long offset) {
    this.topic=topic; this.key=key; this.value=value; this.partition=partition; this.offset=offset;
  }

  public static final class Deserializer implements KafkaRecordDeserializationSchema<KafkaEvent> {
    public void deserialize(ConsumerRecord<byte[],byte[]> record, Collector<KafkaEvent> out) {
      // Do not skip Kafka tombstones: Mari requires an explicit normalized delete.
      out.collect(new KafkaEvent(record.topic(), text(record.key()), text(record.value()), record.partition(), record.offset()));
    }
    private static String text(byte[] value) { return value==null ? null : new String(value, StandardCharsets.UTF_8); }
    public TypeInformation<KafkaEvent> getProducedType() { return TypeInformation.of(KafkaEvent.class); }
  }
}
