package com.example.workflowupdater

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.workflowupdater.ui.detail.WorkDetailScreen
import com.example.workflowupdater.ui.main.MainScreen
import com.example.workflowupdater.ui.main.WorksViewModel
import com.example.workflowupdater.ui.main.WorksViewModelFactory

@Composable
fun MainNavigation() {
  val backStack = rememberNavBackStack(Main)
  val context = LocalContext.current

  // Shared across list + detail so tapping a card doesn't require re-fetching the sheet.
  val worksViewModel: WorksViewModel = viewModel(factory = WorksViewModelFactory(context))

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Main> {
          MainScreen(
            viewModel = worksViewModel,
            onWorkClick = { rowNum -> backStack.add(WorkDetail(rowNum)) },
            modifier = Modifier,
          )
        }
        entry<WorkDetail> { key ->
          WorkDetailScreen(
            work = worksViewModel.findWork(key.rowNum),
            onBack = { backStack.removeLastOrNull() },
          )
        }
      },
  )
}
