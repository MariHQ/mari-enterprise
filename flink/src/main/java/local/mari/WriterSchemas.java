package local.mari;
import java.io.Serializable;
import java.util.Map;
import io.confluent.kafka.schemaregistry.client.CachedSchemaRegistryClient;
/** Writer schemas are registered by producers, never inferred from record contents. */
public class WriterSchemas implements Serializable {
  private final String url;
  public WriterSchemas(){this.url=null;}
  public WriterSchemas(String url){this.url=url;}
  private transient CachedSchemaRegistryClient client;
  private CachedSchemaRegistryClient client(){
    if(client==null){var config=new java.util.HashMap<String,Object>();
      String auth=System.getenv("SCHEMA_REGISTRY_BASIC_AUTH_USER_INFO");
      if(auth!=null){config.put("basic.auth.credentials.source","USER_INFO");config.put("basic.auth.user.info",auth);}
      client=new CachedSchemaRegistryClient(url==null?SchemaApply.required("SCHEMA_REGISTRY_URL"):url,128,config);
    }return client;
  }
  public String byId(int id)throws Exception{
    var schema=client().getSchemaById(id);if(!"AVRO".equals(schema.schemaType()))throw new IllegalArgumentException("Expected AVRO writer schema");return schema.canonicalString();
  }
  public String latestValue(String topic)throws Exception{
    var m=client().getLatestSchemaMetadata(topic+"-value");if(m.getSchemaType()!=null&&!"AVRO".equals(m.getSchemaType()))throw new IllegalArgumentException("Expected AVRO writer schema");return m.getSchema();
  }
}
