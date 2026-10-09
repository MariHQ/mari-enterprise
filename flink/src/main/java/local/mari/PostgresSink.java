package local.mari;

import java.sql.*;
import java.nio.ByteBuffer;
import java.util.*;
import org.apache.flink.streaming.api.functions.sink.RichSinkFunction;
import org.apache.flink.configuration.Configuration;
import org.apache.iceberg.shaded.org.apache.avro.Schema;
import org.apache.iceberg.shaded.org.apache.avro.generic.*;
import org.apache.iceberg.shaded.org.apache.avro.io.DecoderFactory;

/** Typed current-state tables. A committed Kafka offset makes replay idempotent,
 * including tombstones. Offsets and writes commit together, before checkpointing. */
public final class PostgresSink extends RichSinkFunction<KafkaEvent> {
  private final IngestionConfig config;
  private final WriterSchemas registry=new WriterSchemas();
  private transient Connection db;
  private transient Map<Integer,Schema> schemas;
  public PostgresSink(IngestionConfig config){this.config=config;}
  static Connection connect() throws SQLException {
    return DriverManager.getConnection(SchemaApply.required("MARI_POSTGRES_JDBC"),
      System.getenv().getOrDefault("MARI_POSTGRES_USER","stack"),SchemaApply.required("MARI_POSTGRES_PASSWORD"));
  }
  static String quote(String name){return "\""+name.replace("\"","\"\"")+"\"";}
  static Schema core(Schema schema){return schema.getType()==Schema.Type.UNION?schema.getTypes().stream().filter(s->s.getType()!=Schema.Type.NULL).findFirst().orElseThrow():schema;}
  static String type(Schema schema){return switch(core(schema).getType()) {
    case STRING,ENUM -> "text"; case LONG -> "bigint"; case INT -> "integer";
    case BOOLEAN -> "boolean"; case DOUBLE -> "double precision"; case FLOAT -> "real";
    case BYTES,FIXED -> "bytea";
    case ARRAY -> {
      String element=type(core(schema).getElementType());
      yield element.equals("jsonb")||element.endsWith("[]")?"jsonb":element+"[]";
    }
    case MAP,RECORD -> "jsonb";
    default -> throw new IllegalArgumentException("Unsupported Avro type: "+schema);
  };}
  static void provision(IngestionConfig config) throws Exception {
    var registry=new WriterSchemas();
    try(var db=connect();var sql=db.createStatement()) {
      sql.execute("CREATE SCHEMA IF NOT EXISTS mari");
      sql.execute("CREATE TABLE IF NOT EXISTS mari.kafka_offsets (topic text, partition_id int, last_offset bigint NOT NULL, PRIMARY KEY(topic,partition_id))");
      for(String topic:config.topics) {
        var schema=new Schema.Parser().parse(registry.latestValue(topic));
        var fields=new ArrayList<String>();
        for(var field:schema.getFields())fields.add(quote(field.name())+" "+type(field.schema()));
        String table="mari."+quote(topic);
        sql.execute("CREATE TABLE IF NOT EXISTS "+table+" ("+String.join(",",fields)+", PRIMARY KEY(project_id,record_id))");
        for(var field:schema.getFields())sql.execute("ALTER TABLE "+table+" ADD COLUMN IF NOT EXISTS "+quote(field.name())+" "+type(field.schema()));
        // Every app paginates by project and time; avoid scanning the full table.
        sql.execute("CREATE INDEX IF NOT EXISTS "+quote(topic+"_time")+" ON "+table+" (project_id,observed_at DESC,record_id)");
      }
    }
  }
  @Override public void open(Configuration ignored)throws Exception{db=connect();db.setAutoCommit(false);schemas=new HashMap<>();}
  GenericRecord decode(byte[] bytes)throws Exception {
    if(bytes==null||bytes.length<6||bytes[0]!=0)throw new IllegalArgumentException("Expected Confluent Avro");
    int id=ByteBuffer.wrap(bytes,1,4).getInt();
    Schema schema=schemas.get(id);
    if(schema==null){schema=new Schema.Parser().parse(registry.byId(id));schemas.put(id,schema);}
    var decoder=DecoderFactory.get().binaryDecoder(bytes,5,bytes.length-5,null);
    var record=(GenericRecord)new GenericDatumReader<>(schema).read(null,decoder);
    if(!decoder.isEnd())throw new IllegalArgumentException("Trailing Avro bytes");
    return record;
  }
  @Override public void invoke(KafkaEvent event,Context ignored)throws Exception {
    if(!config.topics.contains(event.topic))throw new IllegalArgumentException("Undeclared topic");
    var key=decode(event.key);var row=event.value==null?null:decode(event.value);
    for(String field:config.keys.get(event.topic).primaryKey())
      if(key.get(field)==null||(row!=null&&!Objects.equals(key.get(field),row.get(field))))throw new IllegalArgumentException("Invalid Kafka key/value");
    try {
      try(var claim=db.prepareStatement("INSERT INTO mari.kafka_offsets VALUES (?,?,?) ON CONFLICT(topic,partition_id) DO UPDATE SET last_offset=EXCLUDED.last_offset WHERE kafka_offsets.last_offset < EXCLUDED.last_offset RETURNING last_offset")) {
        claim.setString(1,event.topic);claim.setInt(2,event.partition);claim.setLong(3,event.offset);
        try(var result=claim.executeQuery()){if(!result.next()){db.rollback();return;}}
      }
      String table="mari."+quote(event.topic);
      if(row==null) {
        try(var delete=db.prepareStatement("DELETE FROM "+table+" WHERE project_id=? AND record_id=?")) {
          delete.setString(1,key.get("project_id").toString());delete.setString(2,key.get("record_id").toString());delete.executeUpdate();
        }
      } else {
        var names=new ArrayList<String>();var values=new ArrayList<String>();var updates=new ArrayList<String>();
        for(var field:row.getSchema().getFields()) {
          String name=quote(field.name());names.add(name);values.add(type(field.schema()).equals("jsonb")?"?::jsonb":"?");
          if(!config.keys.get(event.topic).primaryKey().contains(field.name()))updates.add(name+"=EXCLUDED."+name);
        }
        try(var upsert=db.prepareStatement("INSERT INTO "+table+" ("+String.join(",",names)+") VALUES ("+String.join(",",values)+") ON CONFLICT(project_id,record_id) DO UPDATE SET "+String.join(",",updates))) {
          int i=1;
          for(var field:row.getSchema().getFields()) {
            Object value=row.get(field.name());
            if(value!=null&&type(field.schema()).endsWith("[]")) {
              String element=type(core(field.schema()).getElementType());
              Object[] items=((Collection<?>)value).stream().map(v->v instanceof CharSequence?v.toString():v).toArray();
              upsert.setArray(i++,db.createArrayOf(element,items));continue;
            }
            if(value!=null&&(type(field.schema()).equals("jsonb")||value instanceof CharSequence))value=value.toString();
            upsert.setObject(i++,value);
          }
          upsert.executeUpdate();
        }
      }
      db.commit();
    } catch(Exception error){db.rollback();throw error;}
  }
  @Override public void close()throws Exception{if(db!=null)db.close();}
}
