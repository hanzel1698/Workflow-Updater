package com.example.workflowupdater.data

import org.junit.Assert.assertEquals
import org.junit.Test

class SheetDateFormatterTest {

  @Test
  fun isoInstant_convertsToKolkataAndFormats() {
    // "2025-01-06T18:30:00.000Z" is midnight of 07 Jan 2025 in Asia/Kolkata (UTC+5:30).
    assertEquals("07/01/2025", SheetDateFormatter.format("2025-01-06T18:30:00.000Z"))
    assertEquals("02/06/2026", SheetDateFormatter.format("2026-06-01T18:30:00.000Z"))
  }

  @Test
  fun isoInstantWithOffset_convertsToKolkata() {
    assertEquals("07/01/2025", SheetDateFormatter.format("2025-01-07T00:00:00+05:30"))
  }

  @Test
  fun blank_returnsEmpty() {
    assertEquals("", SheetDateFormatter.format(""))
    assertEquals("", SheetDateFormatter.format("   "))
  }

  @Test
  fun plainDayMonthYear_normalizesAndZeroPads() {
    assertEquals("07/01/2025", SheetDateFormatter.format("07/01/2025"))
    assertEquals("07/01/2025", SheetDateFormatter.format("7-1-2025"))
    assertEquals("31/03/2018", SheetDateFormatter.format("31/03/2018"))
  }

  @Test
  fun isoDateOnly_formatsWithoutTimezoneShift() {
    assertEquals("07/01/2025", SheetDateFormatter.format("2025-01-07"))
  }

  @Test
  fun freeText_passesThroughUnchanged() {
    assertEquals(
      "After getting intimation from field officials",
      SheetDateFormatter.format("After getting intimation from field officials"),
    )
  }
}
