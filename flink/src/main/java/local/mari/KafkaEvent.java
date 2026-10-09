package local.mari;

import java.io.Serializable;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.connector.kafka.source.reader.deserializer.KafkaRecordDeserializationSchema;
import org.apache.flink.kafka.shaded.org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.flink.util.Collector;

/** Preserve topic and raw schema-encoded bytes for the dynamic sink. */
public class KafkaEvent implements Serializable {
  public String topic;
  public byte[] key, value;
  public int partition;
  public long offset;
  public KafkaEvent() {}
  public KafkaEvent(String topic, byte[] key, byte[] value, int partition, long offset) {
    this.topic=topic; this.key=key; this.value=value; this.partition=partition; this.offset=offset;
  }

  public static final class Deserializer implements KafkaRecordDeserializationSchema<KafkaEvent> {
    public void deserialize(ConsumerRecord<byte[],byte[]> record, Collector<KafkaEvent> out) {
      // Preserve tombstones: the generator emits an equality delete for the key.
      out.collect(new KafkaEvent(record.topic(), record.key(), record.value(), record.partition(), record.offset()));
    }
    public TypeInformation<KafkaEvent> getProducedType() { return TypeInformation.of(KafkaEvent.class); }
  }
}
