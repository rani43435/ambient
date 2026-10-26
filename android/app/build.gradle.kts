import java.util.Properties
plugins { id("com.android.application") }

val keyProps = Properties().apply {
    val f = rootProject.file("signing.properties"); if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "io.github.rani43435.ambient"
    compileSdk = 34
    defaultConfig {
        applicationId = "io.github.rani43435.ambient"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    signingConfigs {
        create("release") {
            if (keyProps.isNotEmpty()) {
                storeFile = rootProject.file(keyProps.getProperty("storeFile"))
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keyProps.isNotEmpty()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}

dependencies { implementation("androidx.webkit:webkit:1.12.1") }
