package local.mari;

import java.util.Arrays;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.rest.RESTCatalog;

/** Preserve dotted Kafka topic names when the dynamic sink round-trips IDs as strings. */
public final class MariCatalog extends RESTCatalog {
  static TableIdentifier canonical(TableIdentifier id) {
    String[] ns=id.namespace().levels();
    if(ns.length>1 && ns[0].equals("mari")) {
      String topic=String.join(".",Arrays.copyOfRange(ns,1,ns.length))+"."+id.name();
      return TableIdentifier.of(ns[0],topic);
    }
    return id;
  }
  @Override public Table createTable(TableIdentifier id, org.apache.iceberg.Schema schema, org.apache.iceberg.PartitionSpec spec, String location, java.util.Map<String,String> props) {return super.createTable(canonical(id),schema,spec,location,props);}
  @Override public Table loadTable(TableIdentifier id) {return super.loadTable(canonical(id));}
  @Override public boolean tableExists(TableIdentifier id) {return super.tableExists(canonical(id));}
  @Override public void invalidateTable(TableIdentifier id) {super.invalidateTable(canonical(id));}
}
