package com.example.workflowupdater

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable data object Main : NavKey

@Serializable data class WorkDetail(val rowNum: Int) : NavKey
