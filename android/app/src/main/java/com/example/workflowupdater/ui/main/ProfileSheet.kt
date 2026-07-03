package com.example.workflowupdater.ui.main

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.SheetConfig

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSheet(
  sheetState: SheetState,
  activeProfile: EngineerProfile,
  defaultProfileId: String,
  onSelect: (EngineerProfile) -> Unit,
  onSetDefault: (EngineerProfile) -> Unit,
  onDismiss: () -> Unit,
) {
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
    Column(modifier = Modifier.padding(horizontal = 20.dp).navigationBarsPadding()) {
      Text(text = "Switch engineer profile", style = MaterialTheme.typography.titleLarge)
      Spacer(Modifier.height(4.dp))
      Text(
        text = "View works at ${SheetConfig.DESIGN_OFFICE} for one engineer or all engineers.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Spacer(Modifier.height(12.dp))

      SheetConfig.selectableProfiles().forEachIndexed { index, profile ->
        ProfileRow(
          profile = profile,
          isActive = profile.id == activeProfile.id,
          isDefault = profile.id == defaultProfileId,
          onClick = {
            onSelect(profile)
            onDismiss()
          },
          onSetDefault = { onSetDefault(profile) },
        )
        if (index != SheetConfig.selectableProfiles().lastIndex) HorizontalDivider()
      }
      Spacer(Modifier.height(20.dp))
    }
  }
}

@Composable
private fun ProfileRow(
  profile: EngineerProfile,
  isActive: Boolean,
  isDefault: Boolean,
  onClick: () -> Unit,
  onSetDefault: () -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
      ProfileAvatar(profile = profile)
      Spacer(Modifier.width(12.dp))
      Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text(text = profileDisplayName(profile), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
          if (isDefault) {
            Spacer(Modifier.width(8.dp))
            Text(
              text = "Default",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.primary,
            )
          }
        }
        profileSubtitle(profile)?.let { subtitle ->
          Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
      IconButton(onClick = onSetDefault) {
        Icon(
          imageVector = if (isDefault) Icons.Filled.Star else Icons.Outlined.StarOutline,
          contentDescription = if (isDefault) "Default profile" else "Set as default profile",
          tint = if (isDefault) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      if (isActive) {
        Icon(Icons.Filled.Check, contentDescription = "Active profile", tint = MaterialTheme.colorScheme.primary)
      } else {
        Spacer(Modifier.width(24.dp))
      }
    }
  }
}
