import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import JobsScreen from "./src/screens/JobsScreen";
import ApplicationsScreen from "./src/screens/ApplicationsScreen";
import CoachScreen from "./src/screens/CoachScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: "#1976d2" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#1976d2",
        tabBarInactiveTintColor: "#9e9e9e",
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Jobs: focused ? "briefcase" : "briefcase-outline",
            Applications: focused ? "list" : "list-outline",
            Coach: focused ? "chatbubbles" : "chatbubbles-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name] || "ellipse"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Jobs" component={JobsScreen} options={{ title: "Discover Jobs" }} />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{ title: "My Applications" }}
      />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ title: "Career Coach" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "My Profile" }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
