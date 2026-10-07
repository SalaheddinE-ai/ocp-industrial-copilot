# OCP Industrial Insight

Design a modern desktop web application for an AI-powered industrial platform called "OCP Maroc Industrial Copilot".

The application is NOT a chatbot. It is an Industrial Knowledge Copilot for centrifugal pump maintenance with interactive 3D visualization.

Design language:

- Premium enterprise software

- Inspired by Blender, Autodesk Fusion 360, Siemens NX, Unreal Engine and Linear.app

- Clean monochrome interface

- Minimalistic

- Black and white theme

- Dark mode by default

- Professional industrial aesthetic

- Glassmorphism only in subtle areas

- Modern spacing

- Rounded corners (12px)

- Premium icons (Lucide Pro / Phosphor / Heroicons style)

- No cartoon illustrations

- No colorful gradients

- Focus on productivity

-------------------------------------------------

TOP NAVIGATION BAR

Height around 70px

Left:

• OCP logo placeholder

• Product title:

"OCP Maroc Industrial Copilot"

Center:

Global Search Bar

Placeholder:

"Search equipment, manuals, procedures..."

Right:

Professional icon buttons

Notifications

User Profile

Settings

Theme Switch

-------------------------------------------------

LEFT SIDEBAR

Collapsible

Contains icons + labels

Dashboard

Equipment Explorer

Digital Twin

AI Assistant

Manual Library

Maintenance Reports

Spare Parts

History

Settings

Each item has a premium outline icon.

-------------------------------------------------

MAIN LAYOUT

Split into three panels.

-------------------------------------------------

LEFT PANEL (25%)

AI Assistant

Looks like ChatGPT but more professional.

Header:

Industrial Assistant

Conversation history

Message input

Voice button

Image upload

PDF upload

Suggested prompts:

"Explain cavitation"

"Show bearing"

"Replace mechanical seal"

"What causes vibration?"

Each response can contain:

Text

Tables

Images

Buttons

Links to manuals

-------------------------------------------------

CENTER PANEL (50%)

Interactive 3D Viewer

This is the largest section.

Large Three.js viewport.

Toolbar on top:

Rotate

Pan

Zoom

Reset View

Exploded View

Section View

Transparency

Wireframe

Measurement

Fullscreen

Below toolbar:

Interactive centrifugal pump.

Realistic metallic material.

Neutral studio lighting.

When selecting a component:

Highlight with cyan outline.

Smooth animation.

Camera automatically focuses.

-------------------------------------------------

RIGHT PANEL (25%)

Component Information Panel

Dynamic.

When no object selected:

Display

"Select a component"

When a component is selected:

Large title

Example:

Mechanical Seal

Below:

Status badge

Healthy

Warning

Critical

Tabs:

Overview

Maintenance

Documents

History

Parts

-------------------------------------------------

OVERVIEW TAB

Displays:

Function

Description

Operating principle

Material

Dimensions

Manufacturer

Life expectancy

-------------------------------------------------

FAILURE SECTION

Failure Modes

Common Symptoms

Possible Causes

Typical Images

-------------------------------------------------

INSPECTION TAB

Inspection checklist

Tools required

Measurements

Tolerances

-------------------------------------------------

MAINTENANCE TAB

Step-by-step procedure

Animated progress

Estimated repair time

Difficulty level

Required PPE

Required torque

-------------------------------------------------

SAFETY TAB

Lock Out Tag Out

Isolation

Hazards

Warnings

Safety equipment

-------------------------------------------------

SPARE PARTS TAB

Compatible bearings

Mechanical seals

Gaskets

Lubricants

Inventory availability

Supplier recommendations

-------------------------------------------------

DOCUMENTS TAB

Maintenance manual

Technical drawing

Exploded drawing

Datasheet

SOP

PDF viewer

-------------------------------------------------

HISTORY TAB

Previous interventions

Date

Technician

Parts replaced

Observations

-------------------------------------------------

BOTTOM PANEL

Optional collapsible terminal/log

Shows:

AI reasoning steps

Retrieved manuals

Selected agent

Execution timeline

-------------------------------------------------

UI DETAILS

Professional enterprise design

Lots of whitespace

Typography similar to Linear

Use Inter font

Soft shadows

Thin borders

Professional monochrome palette

Dark charcoal background

White cards

Gray separators

Subtle hover animations

Smooth transitions

Modern tables

Beautiful accordions

Professional charts

Premium switches

Modern buttons

-------------------------------------------------

3D INTERACTION

Clicking any pump component automatically:

Highlights component

Zooms camera

Displays information

Updates AI context

Shows maintenance procedure

Shows related manuals

Shows historical interventions

Shows compatible spare parts

-------------------------------------------------

Components include:

Pump Casing

Impeller

Shaft

Drive-End Bearing

Non-Drive-End Bearing

Mechanical Seal

Wear Ring

Coupling

Base Plate

Motor

Discharge Flange

Suction Flange

-------------------------------------------------

Overall style:

Imagine ChatGPT + Blender + Siemens NX + Apple Human Interface + Linear + Vercel Dashboard merged into one premium industrial application.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ocp-visual.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fb5959dd-fdd3-4a95-bdb4-4f7f496b78b6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
