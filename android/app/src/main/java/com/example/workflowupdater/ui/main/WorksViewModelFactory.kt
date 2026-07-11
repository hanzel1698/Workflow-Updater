package com.example.workflowupdater.ui.main

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.workflowupdater.data.DefaultWorkflowRepository
import com.example.workflowupdater.data.FileWorksLocalCache
import com.example.workflowupdater.data.ProfilePrefs

/** Supplies [WorksViewModel] with a repository and the persisted-profile store. */
class WorksViewModelFactory(context: Context) : ViewModelProvider.Factory {
  private val appContext = context.applicationContext

  @Suppress("UNCHECKED_CAST")
  override fun <T : ViewModel> create(modelClass: Class<T>): T {
    val repository = DefaultWorkflowRepository(localCache = FileWorksLocalCache(appContext))
    return WorksViewModel(repository, ProfilePrefs(appContext)) as T
  }
}
