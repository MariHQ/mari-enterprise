package guru.mari;
import org.junit.jupiter.api.Test;
import org.apache.iceberg.catalog.TableIdentifier;
import static org.junit.jupiter.api.Assertions.assertEquals;
class TopicJdbcCatalogTest {
    @Test void preservesLiteralTopicAfterSinkSerialization() {
        var original = TableIdentifier.of("mari_streams", "mari.records.slack.message");
        assertEquals(original, TopicJdbcCatalog.literalTopic(TableIdentifier.parse(original.toString())));
        assertEquals(original, TopicJdbcCatalog.literalTopic(original));
        var history = TableIdentifier.of("mari_history", "mari.records.temporal.edge");
        assertEquals(history, TopicJdbcCatalog.literalTopic(TableIdentifier.parse(history.toString())));
    }
    @Test void doesNotChangeExternalNamespaces() {
        var external = TableIdentifier.of("other", "schema", "table");
        assertEquals(external, TopicJdbcCatalog.literalTopic(external));
    }
}
