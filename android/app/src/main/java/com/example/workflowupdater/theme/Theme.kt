package com.example.workflowupdater.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme =
  darkColorScheme(
    primary = AccentViolet,
    onPrimary = Color.White,
    secondary = StatusInfo,
    tertiary = StatusSuccess,
    background = BgApp,
    onBackground = TextPrimary,
    surface = BgSurface,
    onSurface = TextPrimary,
    surfaceVariant = BgCard,
    onSurfaceVariant = TextSecondary,
    surfaceContainer = BgCard,
    surfaceContainerHigh = BgCardElevated,
    surfaceContainerLow = BgSurface,
    outline = BorderSubtle,
    outlineVariant = BorderSubtle,
    error = StatusDanger,
    onError = Color.White,
  )

private val LightColorSchemeScheme =
  lightColorScheme(
    primary = AccentVioletDim,
    background = LightBg,
    surface = LightSurface,
    surfaceVariant = LightCard,
  )

@Composable
fun WorkflowUpdaterTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
  val colorScheme = if (darkTheme) DarkColorScheme else LightColorSchemeScheme
  MaterialTheme(colorScheme = colorScheme, typography = Typography, shapes = WorkflowShapes, content = content)
}
