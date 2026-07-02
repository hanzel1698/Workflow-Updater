package com.example.workflowupdater.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
  onSelect: (EngineerProfile) -> Unit,
  onDismiss: () -> Unit,
) {
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
    Column(modifier = Modifier.padding(horizontal = 20.dp).navigationBarsPadding()) {
      Text(text = "Switch engineer profile", style = MaterialTheme.typography.titleLarge)
      Spacer(Modifier.height(4.dp))
      Text(
        text = "View works assigned to a different engineer at ${SheetConfig.DESIGN_OFFICE}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Spacer(Modifier.height(12.dp))

      SheetConfig.PROFILES.forEachIndexed { index, profile ->
        ProfileRow(
          profile = profile,
          isActive = profile.id == activeProfile.id,
          onClick = {
            onSelect(profile)
            onDismiss()
          },
        )
        if (index != SheetConfig.PROFILES.lastIndex) HorizontalDivider()
      }
      Spacer(Modifier.height(20.dp))
    }
  }
}

@Composable
private fun ProfileRow(profile: EngineerProfile, isActive: Boolean, onClick: () -> Unit) {
  Row(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Box(
        modifier =
          Modifier.size(38.dp)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.18f), CircleShape),
        contentAlignment = Alignment.Center,
      ) {
        Text(text = profile.id.take(2), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
      }
      Spacer(Modifier.width(12.dp))
      Column {
        Text(text = profile.name, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
        if (profile.email.isNotBlank()) {
          Text(text = profile.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }
    if (isActive) {
      Icon(Icons.Filled.Check, contentDescription = "Active profile", tint = MaterialTheme.colorScheme.primary)
    }
  }
}
