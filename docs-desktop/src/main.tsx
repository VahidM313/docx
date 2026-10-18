import React from "react";
import { createRoot } from "react-dom/client";
import { Boot } from "./App";
import "./styles/globals.css";

const root = createRoot(document.getElementById("app-root")!);
root.render(<Boot />);
