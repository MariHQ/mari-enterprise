package local.mari;
import static org.junit.jupiter.api.Assertions.*;
import org.apache.iceberg.catalog.TableIdentifier;
import org.junit.jupiter.api.Test;
class MariCatalogTest {
  @Test void dynamicSinkStringRoundTripPreservesTopicComponent() {
    for(String ns:new String[]{"mari_streams","mari_history"}) {
      var id=TableIdentifier.of(ns,"mari.records.mari.principal");
      assertEquals(id,MariCatalog.canonical(TableIdentifier.parse(id.toString())));
      assertEquals(id,MariCatalog.canonical(id));
    }
    var unrelated=TableIdentifier.parse("other.nested.table");
    assertEquals(unrelated,MariCatalog.canonical(unrelated));
  }
}
