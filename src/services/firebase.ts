import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";

firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

export { firestore, auth, storage };
