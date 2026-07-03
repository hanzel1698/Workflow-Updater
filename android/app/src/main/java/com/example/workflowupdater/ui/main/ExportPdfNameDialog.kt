package com.example.workflowupdater.ui.main

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetConfig

@Composable
fun ExportPdfNameDialog(
  designation: String,
  onDismiss: () -> Unit,
  onConfirm: (engineerName: String) -> Unit,
) {
  var engineerName by remember { mutableStateOf("") }
  val trimmedName = engineerName.trim()
  val isValid = trimmedName.isNotEmpty()
  val profileHint =
    if (designation == SheetConfig.ALL_PROFILE_ID) {
      "Report covers all RDO KKD engineers."
    } else {
      "Profile: $designation"
    }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Export PDF") },
    text = {
      Column {
        Text(
          text = "Enter your name for the report title and file name. $profileHint",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
          value = engineerName,
          onValueChange = { engineerName = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("Engineer's name") },
          placeholder = { Text("e.g. Hanzel H. Fernandez") },
          singleLine = true,
          isError = engineerName.isNotEmpty() && !isValid,
        )
      }
    },
    confirmButton = {
      TextButton(onClick = { onConfirm(trimmedName) }, enabled = isValid) { Text("Export") }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
  )
}
