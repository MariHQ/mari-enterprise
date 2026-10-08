package guru.mari;

import java.util.Arrays;
import org.apache.iceberg.TableOperations;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.jdbc.JdbcCatalog;

/** Preserve literal topic names when the dynamic sink reparses qualified names. */
public final class TopicJdbcCatalog extends JdbcCatalog {
    static TableIdentifier literalTopic(TableIdentifier identifier) {
        String[] namespace = identifier.namespace().levels();
        if (namespace.length > 1 && (namespace[0].equals("mari_streams") || namespace[0].equals("mari_history"))) {
            String name = String.join(".", Arrays.copyOfRange(namespace, 1, namespace.length)) + "." + identifier.name();
            return TableIdentifier.of(namespace[0], name);
        }
        return identifier;
    }

    @Override
    protected TableOperations newTableOps(TableIdentifier identifier) {
        return super.newTableOps(literalTopic(identifier));
    }
}
