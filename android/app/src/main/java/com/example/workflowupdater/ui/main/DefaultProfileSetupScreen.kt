package com.example.workflowupdater.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Engineering
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.SheetConfig

@Composable
fun DefaultProfileSetupScreen(
  onContinue: (EngineerProfile) -> Unit,
  modifier: Modifier = Modifier,
) {
  val profiles = remember { SheetConfig.selectableProfiles() }
  var selectedProfile by remember { mutableStateOf(SheetConfig.ALL_PROFILE) }

  Surface(modifier = modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
    Column(
      modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 32.dp),
      verticalArrangement = Arrangement.SpaceBetween,
    ) {
      Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
        Icon(
          imageVector = Icons.Filled.Engineering,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(text = "Choose your default view", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
          text =
            "Pick the engineer profile to open with each time you launch the app. " +
              "Choose All to see every RDO KKD engineer's works. You can change this later from the profile menu.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        profiles.forEachIndexed { index, profile ->
          DefaultProfileOptionRow(
            profile = profile,
            selected = profile.id == selectedProfile.id,
            onSelect = { selectedProfile = profile },
          )
          if (index != profiles.lastIndex) HorizontalDivider()
        }
      }

      Button(onClick = { onContinue(selectedProfile) }, modifier = Modifier.fillMaxWidth()) {
        Text("Continue")
      }
    }
  }
}

@Composable
private fun DefaultProfileOptionRow(profile: EngineerProfile, selected: Boolean, onSelect: () -> Unit) {
  Row(
    modifier =
      Modifier.fillMaxWidth()
        .selectable(selected = selected, onClick = onSelect, role = Role.RadioButton)
        .padding(vertical = 12.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    RadioButton(selected = selected, onClick = null)
    Spacer(Modifier.width(8.dp))
    ProfileAvatar(profile = profile)
    Spacer(Modifier.width(12.dp))
    Column(modifier = Modifier.weight(1f)) {
      Text(text = profileDisplayName(profile), style = MaterialTheme.typography.bodyLarge)
      profileSubtitle(profile)?.let { subtitle ->
        Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
internal fun ProfileAvatar(profile: EngineerProfile, modifier: Modifier = Modifier) {
  Box(
    modifier =
      modifier
        .size(38.dp)
        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.18f), CircleShape),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text = if (SheetConfig.isAllProfile(profile)) "All" else profile.id.take(2),
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.primary,
    )
  }
}

internal fun profileDisplayName(profile: EngineerProfile): String =
  if (SheetConfig.isAllProfile(profile)) "All engineers" else profile.name

internal fun profileSubtitle(profile: EngineerProfile): String? =
  when {
    SheetConfig.isAllProfile(profile) -> "All works at ${SheetConfig.DESIGN_OFFICE}"
    profile.email.isNotBlank() -> profile.email
    else -> null
  }
