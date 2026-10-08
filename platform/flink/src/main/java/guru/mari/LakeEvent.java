package guru.mari;

import java.io.Serializable;

/** Internal normalized record, never an archived provider response. */
public class LakeEvent implements Serializable {
    public String route;
    public String key;
    public String value;
    public long offset;
    public LakeEvent() {}
    public LakeEvent(String route, String key, String value, long offset) {
        this.route = route; this.key = key; this.value = value; this.offset = offset;
    }
}
