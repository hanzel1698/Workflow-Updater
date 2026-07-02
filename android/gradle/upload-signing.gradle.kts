import java.io.File
import java.util.Properties

data class UploadSigningConfig(
    val storeFile: File,
    val storePassword: String,
    val keyAlias: String,
    val keyPassword: String,
)

fun resolveUploadSigning(): UploadSigningConfig? {
    System.getenv("KEYSTORE_FILE")?.takeIf { it.isNotBlank() }?.let { path ->
        val file = File(path)
        if (file.isFile && file.length() > 100L) {
            return UploadSigningConfig(
                storeFile = file,
                storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "android",
                keyAlias = System.getenv("KEY_ALIAS") ?: "androiddebugkey",
                keyPassword = System.getenv("KEY_PASSWORD") ?: "android",
            )
        }
    }

    val centralDir = File(System.getProperty("user.home"), ".android/signing")
    val centralKeystore = File(centralDir, "upload-keystore.jks")
    if (centralKeystore.isFile && centralKeystore.length() > 100L) {
        val props = Properties()
        File(centralDir, "signing.properties").takeIf { it.isFile }?.inputStream()?.use {
            props.load(it)
        }
        return UploadSigningConfig(
            storeFile = centralKeystore,
            storePassword = props.getProperty("storePassword", "android"),
            keyAlias = props.getProperty("keyAlias", "androiddebugkey"),
            keyPassword = props.getProperty("keyPassword", "android"),
        )
    }

    return null
}
