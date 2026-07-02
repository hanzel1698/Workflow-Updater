package com.example.workflowupdater.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import com.example.workflowupdater.theme.StatusDanger
import com.example.workflowupdater.theme.StatusDangerBg
import com.example.workflowupdater.theme.StatusInfo
import com.example.workflowupdater.theme.StatusInfoBg
import com.example.workflowupdater.theme.StatusNeutral
import com.example.workflowupdater.theme.StatusNeutralBg
import com.example.workflowupdater.theme.StatusSuccess
import com.example.workflowupdater.theme.StatusSuccessBg
import com.example.workflowupdater.theme.StatusWarning
import com.example.workflowupdater.theme.StatusWarningBg

data class StatusTone(val foreground: Color, val background: Color)

/** Maps a two-digit design-status code ("01".."09") to a foreground/background color pair
 *  used for badges and KPI chips, mirroring the semantic coloring in windows/index.html. */
@Composable
@ReadOnlyComposable
fun statusTone(code: String): StatusTone =
  when (code) {
    "01", "04" -> StatusTone(StatusInfo, StatusInfoBg)
    "02", "05" -> StatusTone(StatusWarning, StatusWarningBg)
    "03", "06" -> StatusTone(StatusSuccess, StatusSuccessBg)
    "08", "09" -> StatusTone(StatusDanger, StatusDangerBg)
    else -> StatusTone(StatusNeutral, StatusNeutralBg)
  }
