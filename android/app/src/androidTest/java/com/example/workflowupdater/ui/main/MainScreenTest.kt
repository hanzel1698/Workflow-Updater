package com.example.workflowupdater.ui.main

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.WorkItem
import com.example.workflowupdater.theme.WorkflowUpdaterTheme
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** UI test for the read-only work detail screen. */
class WorkDetailScreenTest {

  @get:Rule val composeTestRule = createAndroidComposeRule<ComponentActivity>()

  private val sampleWork: WorkItem = WorkItem.fromRow(SheetConfig.MOCK_ROWS.first())

  @Before
  fun setup() {
    composeTestRule.setContent {
      WorkflowUpdaterTheme {
        com.example.workflowupdater.ui.detail.WorkDetailScreen(work = sampleWork, onBack = {})
      }
    }
  }

  @Test
  fun workName_isDisplayed() {
    composeTestRule.onNodeWithText(sampleWork.workName).assertExists()
  }
}
