// The app itself is not part of the proof. It exists so `expo prebuild` has something real to
// generate a native project for; the app icon is built at prebuild time, not at runtime.
import {StyleSheet, Text, View} from "react-native";

export default function App() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>config-tv icon layers repro</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {alignItems: "center", backgroundColor: "#101418", flex: 1, justifyContent: "center"},
    text: {color: "#ffffff", fontSize: 32},
});
